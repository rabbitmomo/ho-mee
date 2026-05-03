import streamlit as st
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
import joblib
import plotly.express as px
from datetime import datetime

# ---------------------------
# Configuration
# ---------------------------
st.set_page_config(page_title="AC Predictive Maintenance", layout="wide")
st.title("❄️ Air Conditioner Predictive Maintenance")
st.markdown("Upload a CSV file with AC readings – get **risk predictions** (Healthy / Monitor / Risk) using a Random Forest model.")

# ---------------------------
# Helper functions
# ---------------------------
def feature_engineering(df):
    """Add all required features for the model."""
    df = df.copy()
    # Ensure timestamp is datetime
    if 'timestamp' in df.columns:
        df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce')
        df['hour'] = df['timestamp'].dt.hour
        df['day_of_week'] = df['timestamp'].dt.dayofweek
    else:
        # fallback if no timestamp: use constant hour 12 and Monday
        df['hour'] = 12
        df['day_of_week'] = 0
    
    # Encode wind speed
    wind_map = {'Low': 0, 'Medium': 1, 'High': 2, 'Auto': 3}
    df['wind_encoded'] = df['wind_speed'].map(wind_map).fillna(1)  # default Medium
    
    # Sort by time to create lags (important for time series)
    if 'timestamp' in df.columns:
        df = df.sort_values('timestamp')
    
    # Lag features (previous power readings)
    df['power_lag1'] = df['power_w'].shift(1)
    df['power_lag2'] = df['power_w'].shift(2)
    df['power_lag3'] = df['power_w'].shift(3)
    df['power_rolling_mean2'] = df['power_w'].rolling(2).mean()
    df['power_change_pct'] = df['power_w'].pct_change() * 100
    
    # Load percentage (assume rated power = 1800W)
    rated_power = 1800
    df['load_pct'] = (df['power_w'] / rated_power) * 100
    df['temp_load'] = df['temp_c'] * df['load_pct']
    
    # Drop rows with NaN from lags/rolling
    df = df.dropna().reset_index(drop=True)
    return df

def get_feature_columns():
    return ['power_w', 'confidence', 'temp_c', 'wind_encoded', 'hour', 'day_of_week',
            'power_lag1', 'power_lag2', 'power_lag3', 'power_rolling_mean2',
            'power_change_pct', 'load_pct', 'temp_load']

def train_model(df_with_risk):
    """Train a Random Forest model from uploaded data that includes 'risk' column."""
    df = feature_engineering(df_with_risk)
    if df.empty:
        st.error("Not enough data for feature engineering (need at least 4 rows).")
        return None, None, None
    
    X = df[get_feature_columns()]
    y = df['risk']
    
    # Encode target
    le = LabelEncoder()
    y_enc = le.fit_transform(y)
    
    # Scale features (though RF is tree-based, scaling doesn't hurt)
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    # Train model
    model = RandomForestClassifier(n_estimators=100, max_depth=5, random_state=42, class_weight='balanced')
    model.fit(X_scaled, y_enc)
    
    return model, scaler, le

def predict(model, scaler, le, df_input):
    """Predict risk levels for a dataframe (must contain same raw columns)."""
    df_feat = feature_engineering(df_input)
    if df_feat.empty:
        return pd.DataFrame()
    X = df_feat[get_feature_columns()]
    X_scaled = scaler.transform(X)
    pred_enc = model.predict(X_scaled)
    pred_labels = le.inverse_transform(pred_enc)
    df_feat['predicted_risk'] = pred_labels
    return df_feat

# ---------------------------
# Load or train model
# ---------------------------
@st.cache_resource
def get_model():
    """Try to load existing model, else return None (will be trained from upload)."""
    try:
        model = joblib.load('ac_model.pkl')
        scaler = joblib.load('ac_scaler.pkl')
        le = joblib.load('ac_label_encoder.pkl')
        return model, scaler, le
    except:
        return None, None, None

model, scaler, le = get_model()

# ---------------------------
# Sidebar for training/upload
# ---------------------------
st.sidebar.header("Model Training (Optional)")
st.sidebar.markdown("If you have a CSV with a `risk` column, upload it below to **train a new model**.")
train_file = st.sidebar.file_uploader("Upload training CSV (with risk column)", type=['csv'])
if train_file is not None:
    train_df = pd.read_csv(train_file)
    required_cols = {'timestamp', 'power_w', 'confidence', 'temp_c', 'wind_speed', 'risk'}
    if required_cols.issubset(train_df.columns):
        with st.spinner("Training Random Forest model..."):
            model, scaler, le = train_model(train_df)
            if model:
                # Save for future use
                joblib.dump(model, 'ac_model.pkl')
                joblib.dump(scaler, 'ac_scaler.pkl')
                joblib.dump(le, 'ac_label_encoder.pkl')
                st.sidebar.success("✅ Model trained and saved!")
    else:
        st.sidebar.error(f"Training CSV must contain: {required_cols}")
else:
    if model is None:
        st.sidebar.warning("No trained model found. Please upload a training CSV (with `risk` column) first.")
    else:
        st.sidebar.success("Pre-trained model loaded (based on sample data).")

# ---------------------------
# Main prediction area
# ---------------------------
st.header("📁 Upload CSV for Prediction")
uploaded_file = st.file_uploader("Choose a CSV file (must contain: timestamp, power_w, confidence, temp_c, wind_speed)", type='csv')

if uploaded_file is not None:
    try:
        input_df = pd.read_csv(uploaded_file)
        required_input = {'timestamp', 'power_w', 'confidence', 'temp_c', 'wind_speed'}
        if not required_input.issubset(input_df.columns):
            st.error(f"Missing required columns. Need: {required_input}")
        elif model is None:
            st.error("No model available. Please train a model first using the sidebar.")
        else:
            # Predict
            result_df = predict(model, scaler, le, input_df)
            if result_df.empty:
                st.warning("Not enough consecutive readings to create lag features (need at least 4 rows).")
            else:
                st.success(f"Predictions completed for {len(result_df)} rows.")
                
                # Show results table
                st.subheader("🔮 Prediction Results")
                display_cols = ['timestamp', 'power_w', 'temp_c', 'wind_speed', 'predicted_risk']
                # keep only columns that exist
                display_cols = [c for c in display_cols if c in result_df.columns]
                st.dataframe(result_df[display_cols], use_container_width=True)
                
                # Visualize predictions over time
                if 'timestamp' in result_df.columns:
                    fig = px.line(result_df, x='timestamp', y='power_w', color='predicted_risk',
                                  title="Power Consumption colored by Predicted Risk",
                                  labels={'power_w': 'Power (W)', 'timestamp': 'Time'})
                    st.plotly_chart(fig, use_container_width=True)
                    
                    # Risk distribution
                    risk_counts = result_df['predicted_risk'].value_counts().reset_index()
                    risk_counts.columns = ['Risk Level', 'Count']
                    fig_pie = px.pie(risk_counts, values='Count', names='Risk Level', title="Risk Distribution")
                    st.plotly_chart(fig_pie, use_container_width=True)
                
                # Download predictions
                csv_output = result_df.to_csv(index=False)
                st.download_button("📥 Download predictions CSV", csv_output, "ac_predictions.csv", "text/csv")
                
    except Exception as e:
        st.error(f"Error processing file: {e}")
else:
    st.info("Awaiting CSV upload. Example format:\n\n"
            "| timestamp | power_w | confidence | temp_c | wind_speed |\n"
            "|-----------|---------|------------|--------|------------|\n"
            "| 03/05/2026 07:56 PM | 1327.37 | 97 | 26 | Medium |")

st.markdown("---")
st.markdown("### How it works")
st.markdown("""
- The model uses the last 3 power readings, rolling averages, change percentage, load % (based on 1800W rated), and an interaction term `temp * load`.
- Missing lags automatically exclude the first few rows.
- If you have historical data with actual `risk` labels, use the sidebar to train a better model.
""")