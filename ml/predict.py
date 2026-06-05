import os
import pickle
import json
import sys

def main():
    # Expected args:
    # predict.py <amount> <merchant_days_active> <distance_km> <reported_count> <is_verified_badge> <name_similarity_index> <is_blacklisted> <tampering_detected>
    if len(sys.argv) < 9:
        print(json.dumps({
            "status": "error",
            "message": f"Expected 8 arguments, got {len(sys.argv) - 1}. Usage: predict.py <amount> <days_active> <distance> <reports> <verified> <name_sim> <blacklisted> <tampering>"
        }))
        sys.exit(1)

    try:
        amount = float(sys.argv[1])
        days_active = int(sys.argv[2])
        distance = float(sys.argv[3])
        reports = int(sys.argv[4])
        verified = int(sys.argv[5])
        name_sim = int(sys.argv[6])
        blacklisted = int(sys.argv[7])
        tampering = int(sys.argv[8])
    except Exception as e:
        print(json.dumps({
            "status": "error",
            "message": f"Invalid argument formats: {str(e)}"
        }))
        sys.exit(1)

    ml_dir = os.path.dirname(__file__)
    model_path = os.path.join(ml_dir, 'model.pkl')

    # If model file is missing, try to train it
    if not os.path.exists(model_path):
        try:
            # Run train.py inline
            import train
            train.main()
        except Exception as e:
            # If train fails (e.g. sklearn not installed), print fallback JSON
            # This is parsed by Node.js as the fallback ML score
            fallback_prob = 0.1
            if blacklisted == 1: fallback_prob = 0.99
            elif tampering == 1: fallback_prob = 0.75
            elif name_sim == 1: fallback_prob = 0.45
            if reports > 0: fallback_prob += min(reports * 0.15, 0.4)
            if distance > 15: fallback_prob += 0.20
            if verified == 1: fallback_prob -= 0.15
            fallback_prob = max(0.0, min(1.0, fallback_prob))
            
            print(json.dumps({
                "status": "fallback",
                "fraud_probability": fallback_prob,
                "is_fraud": 1 if fallback_prob > 0.40 else 0,
                "note": f"Fallback calculation due to: {str(e)}"
            }))
            sys.exit(0)

    try:
        with open(model_path, 'rb') as f:
            model = pickle.load(f)
            
        # Feature Vector
        features = [[amount, days_active, distance, reports, verified, name_sim, blacklisted, tampering]]
        
        # Inference
        prob = model.predict_proba(features)[0][1] # probability of class 1 (fraud)
        prediction = int(model.predict(features)[0])
        
        print(json.dumps({
            "status": "success",
            "fraud_probability": float(prob),
            "is_fraud": prediction
        }))
        
    except Exception as e:
        print(json.dumps({
            "status": "error",
            "message": f"Error running ML inference: {str(e)}"
        }))
        sys.exit(1)

if __name__ == '__main__':
    main()
