import json

with open('ml/outputs/eval_results/raw_probabilities.json') as f:
    probs = json.load(f)

for pipe, item_list in probs.items():
    for item in item_list:
        if '370' in item.get('image_name', ''):
            probs_str = [round(p, 4) for p in item['probs']]
            print(f"{pipe:<23}: Name={item['image_name']}, True={item['true_grade']}, Pred={item['pred_grade']}, P(Ref)={item['p_referable']:.4f}, Softmax={probs_str}")

