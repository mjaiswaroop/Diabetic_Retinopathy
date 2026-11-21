import json

with open('ml/outputs/eval_results/ablation_metrics.json') as f:
    d = json.load(f)

print(f"{'Pipeline':<22} | {'QWK':<6} | {'AUC':<6} | {'Sens':<6} | {'Spec':<6} | {'ECE':<6} | {'FP':<3} | {'FN':<3}")
print('-' * 70)
for k, v in d.items():
    print(f"{k:<22} | {v['qwk']:.4f} | {v['auc']:.4f} | {v['sensitivity']:.4f} | {v['specificity']:.4f} | {v['ece']:.4f} | {v['fp']:<3} | {v['fn']:<3}")

with open('ml/outputs/eval_results/raw_probabilities.json') as f:
    probs = json.load(f)

print('\nIDRiD_370 Predictions across pipelines:')
for pipe, preds in probs.items():
    if 'IDRiD_370' in preds:
        info = preds['IDRiD_370']
        pred_grade = info['pred_grade']
        p_ref = info['p_referable']
        probs_str = ', '.join([f"{p:.3f}" for p in info['probs']])
        print(f"{pipe:<22}: Pred Grade {pred_grade}, P(Referable)={p_ref:.4f}, Softmax: [{probs_str}]")

