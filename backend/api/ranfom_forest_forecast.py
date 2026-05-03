import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import joblib
import sys
import warnings
warnings.filterwarnings('ignore')

# ============================================
# 1. Feature engineering (lags, rolling stats, time features)
# ============================================
def add_features(df):
    """Creates lag features, rolling means, etc. for time series forecasting."""
    df = df.copy()
    # Ensure timestamp is datetime and sort by time
    df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce')
    if df['timestamp'].isna().any():
        raise ValueError("Invalid timestamp format. Use parseable dates (e.g., 'YYYY-MM-DD HH:MM:SS' or 'dd/mm/yyyy HH:MM AM/PM').")
    df = df.sort_values('timestamp').reset_index(drop=True)

    # Encode wind speed
    wind_mapping = {'Low': 0, 'Medium': 1, 'High': 2, 'Auto': 3}
    if 'wind_speed' in df.columns:
        df['wind_encoded'] = df['wind_speed'].map(wind_mapping)
        if df['wind_encoded'].isna().any():
            raise ValueError("wind_speed must be one of: Low, Medium, High, Auto")
    else:
        raise ValueError("CSV must contain 'wind_speed' column")

    # Time features
    df['hour'] = df['timestamp'].dt.hour
    df['day_of_week'] = df['timestamp'].dt.dayofweek

    # Lag features (previous power readings)
    for lag in [1, 2, 3]:
        df[f'power_lag{lag}'] = df['power_w'].shift(lag)

    # Rolling statistics
    df['power_rolling_mean2'] = df['power_w'].rolling(2).mean()
    df['power_rolling_std2'] = df['power_w'].rolling(2).std()

    # Percentage change
    df['power_change_pct'] = df['power_w'].pct_change() * 100

    # Load percentage (assuming rated power = 1800W – adjust if needed)
    rated_power = 1800.0
    df['load_pct'] = (df['power_w'] / rated_power) * 100

    # Confidence column (if present, use it; else default 0.5)
    if 'confidence' in df.columns:
        df['confidence_scaled'] = df['confidence'] / 100.0
    else:
        df['confidence_scaled'] = 0.5  # neutral confidence

    # Drop rows with NaN from lags/rolling
    df = df.dropna().reset_index(drop=True)
    if len(df) < 10:
        raise ValueError(f"Too few rows after feature engineering: {len(df)}. Need at least 10.")
    return df

# ============================================
# 2. Prepare data for 1-step ahead prediction
# ============================================
def prepare_data(df, forecast_horizon=1):
    """
    For each row, target = power value `forecast_horizon` steps ahead.
    Features = current known values (lags, temp, wind, etc.).
    """
    df_feat = add_features(df)
    X_cols = ['temp_c', 'wind_encoded', 'hour', 'day_of_week',
              'power_lag1', 'power_lag2', 'power_lag3',
              'power_rolling_mean2', 'power_rolling_std2',
              'power_change_pct', 'load_pct', 'confidence_scaled']
    # Keep only columns that exist in df_feat
    X_cols = [c for c in X_cols if c in df_feat.columns]
    X = df_feat[X_cols]
    # Target: shift power_w by forecast_horizon
    y = df_feat['power_w'].shift(-forecast_horizon)
    # Align lengths
    valid_idx = ~(X.isna().any(axis=1) | y.isna())
    X = X[valid_idx]
    y = y[valid_idx]
    timestamps = df_feat['timestamp'][valid_idx].values
    return X, y, timestamps, X_cols

# ============================================
# 3. Train Random Forest Regressor
# ============================================
def train_model(X_train, y_train):
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    model = RandomForestRegressor(n_estimators=100, max_depth=8,
                                  random_state=42, n_jobs=-1)
    model.fit(X_train_scaled, y_train)
    return model, scaler

# ============================================
# 4. Evaluate and plot
# ============================================
def evaluate(model, scaler, X_test, y_test, timestamps_test):
    X_test_scaled = scaler.transform(X_test)
    y_pred = model.predict(X_test_scaled)
    mae = mean_absolute_error(y_test, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    r2 = r2_score(y_test, y_pred)
    print(f"\n--- Evaluation ---")
    print(f"MAE: {mae:.2f} W")
    print(f"RMSE: {rmse:.2f} W")
    print(f"R²: {r2:.3f}")

    # Plot actual vs predicted
    plt.figure(figsize=(12, 5))
    plt.plot(timestamps_test, y_test.values, label='Actual', alpha=0.7)
    plt.plot(timestamps_test, y_pred, label='Predicted (1-step ahead)', alpha=0.7)
    plt.xlabel('Time')
    plt.ylabel('Power (W)')
    plt.title('Random Forest Forecast - Next Step Power')
    plt.legend()
    plt.xticks(rotation=45)
    plt.tight_layout()
    plt.savefig('forecast_plot.png')
    print("Plot saved as 'forecast_plot.png'")
    plt.show()
    return y_pred

# ============================================
# 5. Multi-step future forecast (recursive)
# ============================================
def forecast_future(model, scaler, last_row, feature_cols, steps=6):
    """
    Recursively predict next `steps` power values.
    `last_row` is a DataFrame with the most recent known features (1 row).
    """
    future_predictions = []
    # Make a mutable copy of the last row
    current = last_row.copy().iloc[0].to_dict()
    for step in range(steps):
        # Prepare input array (order must match feature_cols)
        X_input = np.array([[current[col] for col in feature_cols]])
        X_scaled = scaler.transform(X_input)
        pred = model.predict(X_scaled)[0]
        future_predictions.append(pred)
        # Update lag features for next iteration (shift)
        current['power_lag3'] = current['power_lag2']
        current['power_lag2'] = current['power_lag1']
        current['power_lag1'] = pred
        current['power_rolling_mean2'] = (current['power_lag1'] + current['power_lag2']) / 2
        current['power_rolling_std2'] = np.std([current['power_lag1'], current['power_lag2'], current['power_lag3']])
        current['power_change_pct'] = ((pred - current['power_lag2']) / current['power_lag2']) * 100 if current['power_lag2'] != 0 else 0
        current['load_pct'] = (pred / 1800) * 100
        # Keep confidence and other static features unchanged
    return future_predictions

# ============================================
# MAIN
# ============================================
def main(csv_path):
    print(f"Loading CSV from: {csv_path}")
    df = pd.read_csv(csv_path)
    
    # Check required columns
    required = {'timestamp', 'power_w', 'temp_c', 'wind_speed'}
    if not required.issubset(df.columns):
        raise ValueError(f"CSV must contain columns: {required}. Found: {df.columns.tolist()}")
    
    print(f"Loaded {len(df)} rows.")
    print(f"Columns: {df.columns.tolist()}")
    
    # Prepare data (1-step ahead forecast)
    X, y, timestamps, feature_cols = prepare_data(df, forecast_horizon=1)
    print(f"Prepared {len(X)} samples after feature engineering.")
    
    # Train/test split (time‑ordered)
    split_idx = int(len(X) * 0.8)
    X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
    y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]
    timestamps_test = timestamps[split_idx:]
    
    # Train model
    model, scaler = train_model(X_train, y_train)
    
    # Evaluate
    evaluate(model, scaler, X_test, y_test, timestamps_test)
    
    # Multi-step forecast (next 6 steps)
    # Get the last row of features from the full dataset
    last_known = X.iloc[-1:].copy()
    future_steps = 6
    future_powers = forecast_future(model, scaler, last_known, feature_cols, steps=future_steps)
    print(f"\nNext {future_steps} predicted power values (W):")
    for i, p in enumerate(future_powers, 1):
        print(f"  Step {i}: {p:.2f} W")
    
    # Save model and scaler
    joblib.dump(model, 'rf_power_forecast_model.pkl')
    joblib.dump(scaler, 'rf_scaler.pkl')
    print("\nModel saved as 'rf_power_forecast_model.pkl' and 'rf_scaler.pkl'")
    return model, scaler

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python aircon_power_forecast.py <path_to_csv>")
        print("Example: python aircon_power_forecast.py ac_readings.csv")
        sys.exit(1)
    csv_path = sys.argv[1]
    main(csv_path)