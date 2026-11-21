"""
Bootstrap comparison between candidate pipelines:
- dev_deployed_pipeline
- dev_raw_384
- dev_crop_384
- dev_crop_224

Computes paired bootstrap differences (95% CI) for QWK, AUC, Sensitivity, and Specificity.
"""
import json
import numpy as np
import pandas as pd
from sklearn.metrics import cohen_kappa_score, roc_auc_score

with open('ml/outputs/eval_results/raw_probabilities.json') as f:
    probs = json.load(f)

df = pd.read_csv(r'C:\Users\jaisw\Downloads\archive\idrid_labels.csv')
dev_df = df[~df['id_code'].str.contains('test', case=False, na=False)].reset_index(drop=True)
y_true_grades = dev_df['diagnosis'].values
y_true_bin = (y_true_grades >= 2).astype(int)

def eval_preds(p_matrix, tau=0.5):
    preds_grade = np.argmax(p_matrix, axis=1)
    p_ref = p_matrix[:, 2:].sum(axis=1)
    preds_bin = (p_ref >= tau).astype(int)
    
    qwk = cohen_kappa_score(y_true_grades, preds_grade, weights='quadratic')
    auc = roc_auc_score(y_true_bin, p_ref)
    
    tp = np.sum((preds_bin == 1) & (y_true_bin == 1))
    fn = np.sum((preds_bin == 0) & (y_true_bin == 1))
    tn = np.sum((preds_bin == 0) & (y_true_bin == 0))
    fp = np.sum((preds_bin == 1) & (y_true_bin == 0))
    
    sens = tp / (tp + fn) if (tp + fn) > 0 else 0
    spec = tn / (tn + fp) if (tn + fp) > 0 else 0
    
    return qwk, auc, sens, spec

n_boot = 1000
np.random.seed(42)
n_samples = len(y_true_grades)

p_dep = np.array(probs['dev_deployed_pipeline'])
p_raw384 = np.array(probs['dev_raw_384'])
p_crop384 = np.array(probs['dev_crop_384'])
p_crop224 = np.array(probs['dev_crop_224'])

diffs_crop384_vs_dep = {'qwk': [], 'auc': [], 'sens': [], 'spec': []}
diffs_raw384_vs_dep = {'qwk': [], 'auc': [], 'sens': [], 'spec': []}
diffs_crop384_vs_raw384 = {'qwk': [], 'auc': [], 'sens': [], 'spec': []}

for _ in range(n_boot):
    idx = np.random.choice(n_samples, size=n_samples, replace=True)
    if len(np.unique(y_true_bin[idx])) < 2:
        continue
        
    qwk_d, auc_d, sens_d, spec_d = eval_preds(p_dep[idx])
    qwk_r, auc_r, sens_r, spec_r = eval_preds(p_raw384[idx])
    qwk_c, auc_c, sens_c, spec_c = eval_preds(p_crop384[idx])
    
    diffs_crop384_vs_dep['qwk'].append(qwk_c - qwk_d)
    diffs_crop384_vs_dep['auc'].append(auc_c - auc_d)
    diffs_crop384_vs_dep['sens'].append(sens_c - sens_d)
    diffs_crop384_vs_dep['spec'].append(spec_c - spec_d)
    
    diffs_raw384_vs_dep['qwk'].append(qwk_r - qwk_d)
    diffs_raw384_vs_dep['auc'].append(auc_r - auc_d)
    diffs_raw384_vs_dep['sens'].append(sens_r - sens_d)
    diffs_raw384_vs_dep['spec'].append(spec_r - spec_d)

print("=== Paired Bootstrap Comparison (1000 resamples, 95% CI) ===")
print("\n[crop_384 minus deployed_pipeline]:")
for metric in ['qwk', 'auc', 'sens', 'spec']:
    vals = diffs_crop384_vs_dep[metric]
    mean_val = np.mean(vals)
    ci_low = np.percentile(vals, 2.5)
    ci_high = np.percentile(vals, 97.5)
    print(f"  Δ {metric.upper():<4}: mean = {mean_val:+.4f} (95% CI: [{ci_low:+.4f}, {ci_high:+.4f}])")

print("\n[raw_384 minus deployed_pipeline]:")
for metric in ['qwk', 'auc', 'sens', 'spec']:
    vals = diffs_raw384_vs_dep[metric]
    mean_val = np.mean(vals)
    ci_low = np.percentile(vals, 2.5)
    ci_high = np.percentile(vals, 97.5)
    print(f"  Δ {metric.upper():<4}: mean = {mean_val:+.4f} (95% CI: [{ci_low:+.4f}, {ci_high:+.4f}])")

