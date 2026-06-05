import pandas as pd
import numpy as np
import os

def generate_synthetic_data(num_samples=1200):
    np.random.seed(42)
    
    # Features
    # amount: 10 to 50000 INR
    amounts = np.random.exponential(scale=500, size=num_samples)
    amounts = np.clip(amounts, 1, 100000)
    
    # merchant_days_active: 0 to 1500 days
    days_active = np.random.randint(0, 1500, size=num_samples)
    
    # distance_km: 0 to 1000 km
    distances = np.random.exponential(scale=5, size=num_samples)
    distances = np.clip(distances, 0, 1500)
    
    # reported_count: 0 to 10 flags
    reported_counts = np.random.zipf(a=2.5, size=num_samples) - 1
    reported_counts = np.clip(reported_counts, 0, 20)
    
    # is_verified_badge: 0 or 1
    verified_badges = np.random.choice([0, 1], size=num_samples, p=[0.6, 0.4])
    
    # name_similarity_index: 0 (genuine-like) or 1 (suspicious keyword like 'winner', 'prize')
    name_similarity = np.random.choice([0, 1], size=num_samples, p=[0.92, 0.08])
    
    # is_blacklisted: 0 or 1
    blacklisted = np.random.choice([0, 1], size=num_samples, p=[0.97, 0.03])
    
    # tampering_detected: 0 or 1
    tampering = np.random.choice([0, 1], size=num_samples, p=[0.95, 0.05])
    
    # Target label: is_fraud
    is_fraud = []
    
    for i in range(num_samples):
        score = 0
        
        # Heavy flags
        if blacklisted[i] == 1:
            score += 0.95
        if tampering[i] == 1:
            score += 0.65
        if name_similarity[i] == 1:
            score += 0.40
            
        # Cumulative risks
        if reported_counts[i] > 2:
            score += 0.35
        elif reported_counts[i] > 0:
            score += 0.15
            
        if days_active[i] < 7:
            score += 0.30
        elif days_active[i] < 30:
            score += 0.15
            
        if distances[i] > 20:
            score += 0.20
            
        if verified_badges[i] == 1:
            score -= 0.15
            
        # Add random noise to make the ML problem realistic
        score += np.random.normal(0, 0.08)
        
        # Binary assignment based on score threshold
        is_fraud.append(1 if score > 0.40 else 0)
        
    df = pd.DataFrame({
        'amount': amounts,
        'merchant_days_active': days_active,
        'distance_km': distances,
        'reported_count': reported_counts,
        'is_verified_badge': verified_badges,
        'name_similarity_index': name_similarity,
        'is_blacklisted': blacklisted,
        'tampering_detected': tampering,
        'is_fraud': is_fraud
    })
    
    # Ensure all directories exist
    os.makedirs(os.path.dirname(__file__), exist_ok=True)
    csv_path = os.path.join(os.path.dirname(__file__), 'upi_fraud_dataset.csv')
    df.to_csv(csv_path, index=False)
    print(f"Generated synthetic dataset with {len(df)} records at {csv_path}")
    print(df['is_fraud'].value_counts(normalize=True))

if __name__ == '__main__':
    generate_synthetic_data()
