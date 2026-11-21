import json
import numpy as np

with open('ml/outputs/eval_results/raw_probabilities.json') as f:
    probs = json.load(f)

# Dev row 334 corresponds to IDRiD_370
print(f"{'Pipeline':<23} | {'P(0)':<7} | {'P(1)':<7} | {'P(2)':<7} | {'P(3)':<7} | {'P(4)':<7} | {'P(Referable)':<12} | {'Pred Grade'}")
print('-' * 88)
for pipe, p_list in probs.items():
    if len(p_list) > 334:
        p = p_list[334]
        p_ref = p[2] + p[3] + p[4]
        pred = int(np.argmax(p))
        print(f"{pipe:<23} | {p[0]:.4f}  | {p[1]:.4f}  | {p[2]:.4f}  | {p[3]:.4f}  | {p[4]:.4f}  | {p_ref:.4f}       | Grade {pred}")

