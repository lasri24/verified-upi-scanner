import os
import pickle
import pandas as pd
import numpy as np

# Try importing scikit-learn. If missing, explain how to install it.
try:
    from sklearn.model_selection import train_test_split
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.metrics import classification_report, accuracy_score
except ImportError:
    print("\n[!] Scikit-learn is not installed. Please run: pip install pandas scikit-learn")
    import sys
    sys.exit(1)

def main():
    ml_dir = os.path.dirname(__file__)
    csv_path = os.path.join(ml_dir, 'upi_fraud_dataset.csv')
    
    # Generate dataset if it does not exist
    if not os.path.exists(csv_path):
        print("Dataset not found. Generating...")
        from dataset import generate_synthetic_data
        generate_synthetic_data()
        
    df = pd.read_csv(csv_path)
    
    # Features & Labels
    X = df.drop(columns=['is_fraud'])
    y = df['is_fraud']
    
    # Train-test split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    
    print(f"Training dataset size: {X_train.shape[0]} samples")
    print(f"Testing dataset size: {X_test.shape[0]} samples")
    
    # Initialize Random Forest Classifier
    rf_model = RandomForestClassifier(n_estimators=100, random_state=42, max_depth=8)
    
    # Fit the model
    rf_model.fit(X_train, y_train)
    
    # Predict & Evaluate
    y_pred = rf_model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    
    print("\n=== Model Performance ===")
    print(f"Accuracy Score: {accuracy:.4f}")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred))
    
    # Feature Importance
    importances = rf_model.feature_importances_
    features = X.columns
    print("Feature Importances:")
    for feat, imp in sorted(zip(features, importances), key=lambda x: x[1], reverse=True):
        print(f" - {feat}: {imp:.4f}")
        
    # Save the model
    model_path = os.path.join(ml_dir, 'model.pkl')
    with open(model_path, 'wb') as f:
        pickle.dump(rf_model, f)
        
    print(f"\n[SUCCESS] ML Model successfully trained and saved to {model_path}")

if __name__ == '__main__':
    main()
