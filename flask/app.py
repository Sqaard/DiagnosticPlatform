from flask import Flask, request, jsonify
import numpy as np
import pandas as pd
from scipy import signal
from flask_cors import CORS
import matplotlib.pyplot as plt
from dotenv import load_dotenv
import tensorflow as tf
import os     
import io
import base64
import cmath
import math
import joblib
# Load environment variables from .env file
load_dotenv()

PORT = int(os.getenv('FLASK_PORT', 5000))
IP = os.getenv('FLASK_IP', '0.0.0.0')

app = Flask(__name__)
CORS(app)

def burg(X: np.ndarray, F: np.ndarray, ext: float, NCOEF: int):

    N = len(F)
    XC = np.copy(F)
    AA = np.copy(F)
    V = np.copy(F)
    dx = X[1] - X[0]

    LC = N + int(N * ext)
    LC = int(2 ** (np.ceil(np.log(LC) / np.log(2))))

    WE = np.empty(NCOEF, dtype=float)
    WE[0] = 1.0
    for J in range(1, NCOEF):
        if len(AA[J:N]) > 0 and len(V[:N-J]) > 0:
            AP = np.sum(AA[J:N] ** 2 + V[:N-J] ** 2)
            XIND = np.sum(AA[J:N] * V[:N-J])
        RC = -2.0 * XIND / AP
        for I in range(J, N):
            TEMP = AA[I]
            AA[I] += RC * V[I - J]
            V[I - J] += RC * TEMP
        WE[J] = 0.0
        JH = (J + 2) // 2
        for I in range(JH):
            K = J - I
            TEMP = WE[K] + RC * WE[I]
            WE[I] = WE[I] + RC * WE[K]
            WE[K] = TEMP

    LP = N + 1
    JH = (LP + LC) // 2
    XC = np.append(XC, np.empty(LC - N, dtype=float)).flatten()
    for I in range(LP, JH + 1):
        XC[I - 1] = 0.0
        XC[LC - I + LP - 1] = 0.0
        for J in range(2, NCOEF + 1):
            XC[I - 1] -= WE[J - 1] * XC[I - J]
            if I - 1 != LC - I + LP - 1:
                XC[LC - I + LP - 1] -= WE[J - 1] * XC[(LC - I + LP + J - 2) % LC]

    Nl = (LC - N) // 2
    Nr = LC - N - Nl
    Fe = list(XC[LC - Nl:])
    Fe.extend(list(XC[:LC - Nl]))
    Xe = np.linspace(X[0] - Nl * dx, X[-1] + Nr * dx, LC)

    return Xe, Fe, Nl, Nr

def validate_data(arr):
    if np.any(np.isnan(arr)) or np.any(np.isinf(arr)):
        return False
    return True

def process_request():
    data = request.json
    x = np.array(data.get('x'))
    y = np.array(data.get('y'))
    if x is None or y is None or len(x) != len(y):
        return jsonify({"error": "Invalid input. x and y must be arrays of the same length."}), 400
    if not validate_data(x) or not validate_data(y):
        return jsonify({"error": "Input contains NaN or Infinity values."}), 400
    return x, y

def process_request_df():
    data = request.json
    if not data:
        return None, jsonify({"error": "No JSON data provided."}), 400
    
    df = pd.DataFrame(data.get('data'))
    if df.empty:
        return None, jsonify({"error": "Empty data provided."}), 400
    
    column_names = df.columns.tolist()
    df = df.rename(columns={'time': 'Time'})
    print(f"First few rows: {df.head().to_dict()}")
    if len(column_names) < 2:
        return None, jsonify({"error": "Data must contain at least two columns."}), 400
    return df, None

def process_response(response_data):
    # Проверяем, что response_data — словарь
    if not isinstance(response_data, dict):
        return jsonify(response_data)  # Если не словарь, просто возвращаем как есть
    
    # Обрабатываем вложенные структуры
    for key, value in response_data.items():
        if isinstance(value, dict):  # Например, "hodographs" или "vectors"
            for sub_key, sub_value in value.items():
                if isinstance(sub_value, list):  # Список точек [{"x": float, "y": float}, ...]
                    cleaned_list = []
                    for point in sub_value:
                        if isinstance(point, dict) and "x" in point and "y" in point:
                            x = point["x"]
                            y = point["y"]
                            cleaned_list.append({"x": float(x), "y": float(y)})
                        else:
                            cleaned_list.append(None)  # Некорректная структура точки
                    value[sub_key] = cleaned_list
                elif isinstance(sub_value, dict):  # Для /vector-graph, где значения — словари
                    for k, v in sub_value.items():
                        if isinstance(v, (int, float)):
                            sub_value[k] = None
                    value[sub_key] = sub_value
    return jsonify(response_data)

def process_phase_data(data, phase_keys):
    phases_data = {}
    for key in phase_keys:
        try:
            phases_data[key] = [float(x) for x in data[key]]
        except (ValueError, TypeError):
            return None, jsonify({"error": f"Non-numeric data in {key}"}), 400
    
    return phases_data, None

def ifft(a):
    N = len(a)
    if N <= 1:
        return a
    even = ifft(a[0::2])
    odd = ifft(a[1::2])
    T = [cmath.exp(2j * cmath.pi * k / N) * odd[k] for k in range(N // 2)]
    return [even[k] + T[k] for k in range(N // 2)] + \
           [even[k] - T[k] for k in range(N // 2)]
def fftshift(x):
    N = len(x)
    return x[N//2:] + x[:N//2]

def fftfreq(N, d=1.0):
    if N % 2 == 0:
        n = list(range(-N//2, N//2))
    else:
        n = list(range(-(N-1)//2, (N-1)//2 + 1))
    return [k / (N * d) for k in n]


def rfftfreq(N, d=1.0):
    return [k / (N * d) for k in range(N // 2 + 1)]

@app.route('/rfft', methods=['POST'])
def compute_rfft():
    try:
        x, y = process_request()
        N = len(y)
        dx = x[1] - x[0]
        S = np.fft.rfft(y)
        f = np.fft.rfftfreq(N, dx)
        A = np.log(np.abs(S) / len(S))
        return jsonify({"frequencies": f.tolist(), "amplitudes": A.tolist()})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/fft', methods=['POST'])
def compute_fft():
    try:
        x, y = process_request()
        N = len(y)
        dx = x[1] - x[0]
        S = np.fft.fftshift(np.fft.fft(y))
        f = np.fft.fftshift(np.fft.fftfreq(N, dx))
        A = np.log(np.abs(S) / len(S))
        phi = np.angle(S)
        return process_response({"frequencies": f.tolist(), "amplitudes": A.tolist(), "phases": phi.tolist()})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def mean(data):
    return sum(data) / len(data)

def variance(data):
    mu = mean(data)
    return sum((x - mu) ** 2 for x in data) / len(data)

def convolve(x, y):
    """Ручная реализация свертки."""
    n, m = len(x), len(y)
    result = [0.0] * (n + m - 1)
    for i in range(n):
        for j in range(m):
            result[i + j] += x[i] * y[j]
    return result

def fft_convolve(x, y):
    """Ручная реализация свертки через FFT."""
    
    # Дополняем массивы до степени двойки
    N = len(x) + len(y) - 1
    N_fft = 2 ** math.ceil(math.log2(N))
    x_padded = x + [0.0] * (N_fft - len(x))
    y_padded = y + [0.0] * (N_fft - len(y))

    # Вычисляем FFT для обоих массивов
    X = np.fft.fft(x_padded)
    Y = np.fft.fft(y_padded)

    # Поэлементное умножение
    Z = [X[k] * Y[k] for k in range(N_fft)]

    # Обратное FFT
    z = ifft(Z)

    # Возвращаем действительную часть результата
    return [val.real for val in z[:N]]

@app.route('/acf', methods=['POST'])
def compute_acf():
    try:
        x, y = process_request()
        N = len(y)

        # Центрирование данных
        y_mean = mean(y)
        yc = [yi - y_mean for yi in y]

        # Вычисление дисперсии
        var = variance(y)

        # Свертка через FFT
        ACF = fft_convolve(yc, yc[::-1])

        # Нормализация на дисперсию
        ACF = [acf_val / (var * N) for acf_val in ACF]

        # Вычисление задержек
        lags = list(range(-N // 2, N // 2))

        # Возвращаем результат
        return jsonify({
            "lags": lags,
            "acf": ACF[N // 2 - 1: 3 * N // 2]  # Центрируем результат
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def hilbert(y):
    """Ручная реализация преобразования Гильберта."""
    N = len(y)
    # Вычисляем FFT
    Y = np.fft.fft(y)
    # Создаем массив для преобразования Гильберта
    H = [0.0] * N
    H[0] = 1.0
    H[N // 2] = 1.0
    for i in range(1, N // 2):
        H[i] = 2.0
    # Поэлементное умножение
    Z = [Y[k] * H[k] for k in range(N)]
    # Обратное FFT
    z = ifft(Z)
    return z

@app.route('/hilbert', methods=['POST'])
def compute_hilbert():
    try:
        x, y = process_request()
        margin = request.json.get('margin', 0.2)
        order = request.json.get('order', 16)
        x_ext, y_ext, Nl, Nr = burg(x, y, margin, order)
        N = len(y)
        S = signal.hilbert(y_ext, N + Nl + Nr)[Nl: N + Nl]
        return jsonify({"imaginary_part": S.imag.tolist()})
    except Exception as e:
        return jsonify({"error": str(e)}), 500    

@app.route('/real_imag_hilbert', methods=['POST'])
def real_imag_hilbert_route():
    try:
        x, y = process_request()
        margin = request.json.get('margin', 0.2)
        order = request.json.get('order', 16)

        # Расширение данных методом Бурга
        x_ext, y_ext, Nl, Nr = burg(x, y, margin, order)
        N = len(y)

        # Применение преобразования Гильберта
        S = hilbert(y_ext)

        # Извлечение центральной части
        S_central = S[Nl: N + Nl]

        # Разделение на действительную и мнимую части
        Re = [s.real for s in S_central]
        Im = [s.imag for s in S_central]

        return jsonify({
            "real_part": Re,
            "imaginary_part": Im
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    
@app.route('/real_imag_fft', methods=['POST'])
def real_imag_fft_route():
    try:
        x, y = process_request()

        # Вычисление FFT
        N = len(y)
        dx = x[1] - x[0]
        S = np.fft.fftshift(np.fft.fft(y))
        Re = S.real  # Реальная часть
        Im = S.imag  # Мнимая часть

        return jsonify({
            "real": Re.tolist(),
            "imaginary": Im.tolist()
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/analytic_signal', methods=['POST'])
def analytic_signal_route():
    try:
        x, y = process_request()
        margin = request.json.get('margin', 0.3)
        order = request.json.get('order', 16)

        # Расширение данных методом Бурга
        x_ext, y_ext, Nl, Nr = burg(x, y, margin, order)
        N = len(y)

        # Применение преобразования Гильберта
        S = hilbert(y_ext)

        # Извлечение центральной части
        S_central = S[Nl: N + Nl]

        # Вычисление амплитуды аналитического сигнала
        A = [abs(s) for s in S_central]

        return jsonify({
            "amplitude": A
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def vector_plot(I1, I2, I3, U1, U2, U3):
    # Normalize currents
    i_norm = max(abs(I1), abs(I2), abs(I3))
    if i_norm == 0:
        i_norm = 1  # Avoid division by zero

    # Calculate current vectors
    Ui1 = abs(I1) / i_norm
    Vi1 = 0.0
    Ui2 = abs(I2) * np.cos(np.deg2rad(-120.0)) / i_norm
    Vi2 = abs(I2) * np.sin(np.deg2rad(-120.0)) / i_norm
    Ui3 = abs(I3) * np.cos(np.deg2rad(120.0)) / i_norm
    Vi3 = abs(I3) * np.sin(np.deg2rad(120.0)) / i_norm

    # Normalize voltages
    u_norm = max(abs(U1), abs(U2), abs(U3))
    if u_norm == 0:
        u_norm = 1  # Avoid division by zero

    # Calculate voltage vectors
    Uu1 = 0.0
    Vu1 = abs(U1) / u_norm
    Uu2 = abs(U2) * np.cos(np.deg2rad(-30.0)) / u_norm
    Vu2 = abs(U2) * np.sin(np.deg2rad(-30.0)) / u_norm
    Uu3 = abs(U3) * np.cos(np.deg2rad(210.0)) / u_norm
    Vu3 = abs(U3) * np.sin(np.deg2rad(210.0)) / u_norm

    # Plot vectors
    plt.figure()
    plt.quiver([0, 0, 0], [0, 0, 0], [Ui1, Ui2, Ui3], [Vi1, Vi2, Vi3], color='r', angles='xy', scale_units='xy', scale=1, label='Currents')
    plt.quiver([0, 0, 0], [0, 0, 0], [Uu1, Uu2, Uu3], [Vu1, Vu2, Vu3], color='b', angles='xy', scale_units='xy', scale=1, label='Voltages')
    plt.xlim(-1.5, 1.5)
    plt.ylim(-1.5, 1.5)
    plt.legend()
    plt.grid()
    plt.title('Vector Plot')

def hodograph(i1, i2, i3, u1, u2, u3):
    # Calculate hodograph coordinates for voltages
    Xu = (2 / 3) * (u1 - 0.5 * u2 - 0.5 * u3)
    Yu = (2 / np.sqrt(3)) * (0.5 * u2 - 0.5 * u3)

    # Calculate hodograph coordinates for currents
    Xi = (2 / 3) * (i1 - 0.5 * i2 - 0.5 * i3)
    Yi = (2 / np.sqrt(3)) * (0.5 * i2 - 0.5 * i3)

    # Plot hodograph
    plt.figure()
    plt.scatter(Xi, Yi, color='r', label='Currents')
    plt.scatter(Xu, Yu, color='b', label='Voltages')
    plt.xlabel('X')
    plt.ylabel('Y')
    plt.legend()
    plt.grid()
    plt.title('Hodograph')

def plot_to_base64():
    buf = io.BytesIO()
    plt.savefig(buf, format='png')
    buf.seek(0)
    plt.clf()  # Clear the current figure
    plt.close()  # Close the figure to free memory
    return base64.b64encode(buf.getvalue()).decode('utf-8')

@app.route('/vector_plot', methods=['POST'])
def vector_plot_endpoint():
    try:
        data = request.get_json()
        I1, I2, I3 = data.get('I1', 0), data.get('I2', 0), data.get('I3', 0)
        U1, U2, U3 = data.get('U1', 0), data.get('U2', 0), data.get('U3', 0)

        # Call the vector_plot function
        vector_plot(I1, I2, I3, U1, U2, U3)

        # Convert plot to base64 for response
        plot_base64 = plot_to_base64()

        return jsonify({"plot": plot_base64})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/hodograph', methods=['POST'])
def hodograph_endpoint():
    try:
        data = request.get_json()
        i1, i2, i3 = data.get('i1', 0), data.get('i2', 0), data.get('i3', 0)
        u1, u2, u3 = data.get('u1', 0), data.get('u2', 0), data.get('u3', 0)

        # Call the hodograph function
        hodograph(i1, i2, i3, u1, u2, u3)

        # Convert plot to base64 for response
        plot_base64 = plot_to_base64()

        return jsonify({"plot": plot_base64})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
def rfft(x, y):
    N = len(y)
    dx = x[1] - x[0]
    S = np.fft.rfft(y)
    f = np.fft.rfftfreq(N, dx)
    A = np.abs(S) / len(S)  
    return A
def analytic_signal(x, y):
    x_ext, y_ext, Nl, Nr = burg(x, y, 0.3, 16)
    N = len(y)
    S = signal.hilbert(y_ext, N + Nl + Nr)
    S = S[Nl : N + Nl]
    A = np.abs(S)
    return A

@app.route('/analyze', methods=['POST'])
def analyze_data():
    try:
        df, error_response = process_request_df()
        if error_response:
            return error_response

        column_names = df.columns.tolist()
        SW = 100
        results = []
        window_anomalies = []

        if len(df) < SW:
            return jsonify({
                "status": "pending",
                "message": f"Недостаточно данных. Требуется минимум {SW} строк, получено {len(df)}.",
                "data_received": len(df)
            }), 202

        # Load model, scaler, and thresholds
        # Verify model files exist
        model_path = "models/model.keras"
        scaler_path = "models/scaler.pkl"
        thresholds_path = "models/thresholds.npy"

        for path in [model_path, scaler_path, thresholds_path]:
            if not os.path.exists(path):
                print(f"File not found: {path}")
                return jsonify({"error": f"File not found: {path}"}), 500

        # Load model, scaler, and thresholds
        print(f"Loading model from {model_path}")
        model = tf.keras.models.load_model(model_path)
        print(f"Loading scaler from {scaler_path}")
        scaler = joblib.load(scaler_path)
        print(f"Loading thresholds from {thresholds_path}")
        thresholds = np.load(thresholds_path)
        num_sensors = len(column_names) - 1  # Exclude Time column

        for i in range(min(100, len(df) - SW + 1)):
            window = df.iloc[i:i+SW, 1:].values  # Shape: (SW, num_sensors)
            window_scaled = scaler.transform(window).reshape(1, SW, num_sensors)
            reconstructed = model.predict(window_scaled, verbose=0).reshape(SW, num_sensors)
            window_results = []
            defects = []
            for j in range(num_sensors):
                error = np.mean((window_scaled[0, :, j] - reconstructed[:, j])**2)
                defect = error > thresholds[j]
                defects.append(bool(defect))  
                result = {
                    "window_end_time": float(df['Time'].values[i + SW - 1]),
                    "column": column_names[j + 1],
                    "reconstruction_error": float(error),
                    "defect": bool(defect)  
                }
                window_results.append(result)
            window_anomaly = any(defects)
            window_anomalies.append(bool(window_anomaly)) 
            results.extend(window_results)

        anomaly_count = sum(window_anomalies)
        if anomaly_count < 50:
            status = "normal"
            message = "В норме"
        elif 50 <= anomaly_count <= 70:
            status = "warning"
            message = "Наблюдение"
        else:
            status = "alert"
            message = "Проверка"

        response_data = {
            "status": "completed",
            "results": results,
            "window_anomalies": window_anomalies,
            "anomaly_count": anomaly_count,
            "diagnosis": {
                "status": status,
                "message": message
            }
        }
        return jsonify(response_data), 200
    except Exception as e:
        return jsonify({"error": f"Ошибка сервера: {str(e)}"}), 500
    
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=PORT)