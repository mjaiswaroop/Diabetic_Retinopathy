"""
Temperature Scaling and Threshold Calibration exclusively on the 375 Dev Images.
Fits temperature T using 5-fold cross-validation.
Selects decision threshold tau on out-of-fold calibrated probabilities to ensure Sensitivity >= 90%.
Then applies T and tau to held-out test set (80 images).
"""
import json
import numpy as np
import pandas as pd
from scipy.optimize import minimize
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import cohen_kappa_score, roc_auc_score

# Load logits or convert probabilities to pseudo-logits
# For exactness, if we have raw softmax p, logit = log(p + 1e-12)
with open('ml/outputs/eval_results/raw_probabilities.json') as f:
    probs = json.load(f)

df = pd.read_csv(r'C:\Users\jaisw\Downloads\archive\idrid_labels.csv')
dev_mask = ~df['id_code'].str.contains('test', case=False, na=False)
test_mask = df['id_code'].str.contains('test', case=False, na=False)

y_dev_grades = df.loc[dev_mask, 'diagnosis'].values
y_dev_bin = (y_dev_grades >= 2).astype(int)

y_test_grades = df.loc[test_mask, 'diagnosis'].values
y_test_bin = (y_test_grades >= 2).astype(int)

def softmax(z):
    exp_z = np.exp(z - np.max(z, axis=1, keepdims=True))
    return exp_z / np.sum(exp_z, axis=1, keepdims=True)

def fit_temperature(logits, y_labels):
    # Optimize T to minimize NLL
    def nll(T):
        scaled_logits = logits / T[0]
        p = softmax(scaled_logits)
        log_p = np.log(np.clip(p[np.arange(len(y_labels)), y_labels], 1e-12, 1.0))
        return -np.mean(log_p)
    
    res = minimize(nll, [1.0], bounds=[(0.05, 10.0)], method='L-BFGS-B')
    return res.x[0]

def compute_ece(probs_ref, y_bin, n_bins=10):
    bin_boundaries = np.linspace(0, 1, n_bins + 1)
    ece = 0.0
    for i in range(n_bins):
        in_bin = (probs_ref > bin_boundaries[i]) & (probs_ref <= bin_boundaries[i + 1])
        prop_in_bin = np.mean(in_bin)
        if prop_in_bin > 0:
            accuracy_in_bin = np.mean(y_bin[in_bin])
            avg_confidence_in_bin = np.mean(probs_ref[in_bin])
            ece += np.abs(avg_confidence_in_bin - accuracy_in_bin) * prop_in_bin
    return ece

# Test both raw_384 and crop_384
for pipe_name in ['dev_raw_384', 'dev_crop_384', 'dev_deployed_pipeline']:
    p_dev = np.array(probs[pipe_name])
    logits_dev = np.log(np.clip(p_dev, 1e-12, 1.0))
    
    # 5-Fold Cross-Validation for T
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    oof_cal_probs = np.zeros_like(p_dev)
    temps = []
    
    for train_idx, val_idx in skf.split(logits_dev, y_dev_grades):
        T_fold = fit_temperature(logits_dev[train_idx], y_dev_grades[train_idx])
        temps.append(T_fold)
        oof_cal_probs[val_idx] = softmax(logits_dev[val_idx] / T_fold)
        
    avg_T = np.mean(temps)
    
    # Out-of-fold Referable Probability: P(Grade >= 2)
    oof_p_ref = oof_cal_probs[:, 2:].sum(axis=1)
    
    ece_before = compute_ece(p_dev[:, 2:].sum(axis=1), y_dev_bin)
    ece_after = compute_ece(oof_p_ref, y_dev_bin)
    
    # Find threshold tau that gives Sensitivity >= 0.90 with maximum Specificity
    thresholds = np.linspace(0.01, 0.99, 500)
    best_tau = 0.50
    best_spec = 0.0
    best_sens = 0.0
    
    for tau in thresholds:
        pred_ref = (oof_p_ref >= tau).astype(int)
        tp = np.sum((pred_ref == 1) & (y_dev_bin == 1))
        fn = np.sum((pred_ref == 0) & (y_dev_bin == 1))
        tn = np.sum((pred_ref == 0) & (y_dev_bin == 0))
        fp = np.sum((pred_ref == 1) & (y_dev_bin == 0))
        sens = tp / (tp + fn)
        spec = tn / (tn + fp)
        
        if sens >= 0.90:
            if spec > best_spec:
                best_spec = spec
                best_sens = sens
                best_tau = tau
                
    print(f"\n==========================================")
    print(f"Pipeline: {pipe_name}")
    print(f"Fitted Temperature (5-fold mean): T = {avg_T:.4f} (folds: {[round(t, 3) for t in temps]})")
    print(f"Dev ECE: Before = {ece_before:.4f} -> After = {ece_after:.4f}")
    print(f"Optimal Threshold for Sens >= 90%: tau = {best_tau:.4f}")
    print(f"Dev Performance at tau={best_tau:.4f}: Sensitivity = {best_sens:.4f}, Specificity = {best_spec:.4f}")
    
    # Check IDRiD_370 (index 334)
    p_370_cal = oof_cal_probs[334]
    p_ref_370 = p_370_cal[2:].sum()
    pred_370_grade = int(np.argmax(p_370_cal))
    is_ref_370 = p_ref_370 >= best_tau
    print(f"IDRiD_370 (Dev #334): Calibrated P(Ref)={p_ref_370:.4f}, Pred Grade={pred_370_grade}, Referable={is_ref_370}")

