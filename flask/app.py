from flask import Flask, request, jsonify
import pywt
import numpy as np
from scipy import signal
import scaleogram as scg 
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

def validate_data(arr):
    if np.any(np.isnan(arr)) or np.any(np.isinf(arr)):
        return False
    return True

def burg(X: np.ndarray, F: np.ndarray, ext: float, NCOEF: int):
    if not validate_data(X) or not validate_data(F):
        raise ValueError("Input contains NaN or Infinity values.")
    
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

def process_request():
    data = request.json
    x = np.array(data.get('x'))
    y = np.array(data.get('y'))
    if x is None or y is None or len(x) != len(y):
        return jsonify({"error": "Invalid input. x and y must be arrays of the same length."}), 400
    if not validate_data(x) or not validate_data(y):
        return jsonify({"error": "Input contains NaN or Infinity values."}), 400
    return x, y
def process_response(response_data):
    for key, value in response_data.items():
        arr = np.array(value)
        if np.any(np.isnan(arr)) or np.any(np.isinf(arr)):
            response_data[key] = [] if arr.ndim > 0 else None
    return jsonify(response_data)

@app.route('/rfft', methods=['POST'])
def rfft():
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
def fft():
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

@app.route('/wavelet', methods=['POST'])
def wavelet():
    try:
        x, y = process_request()
        # wavelet_family = data.get('wavelet_family', "cmor")
        # wavelet_name = data.get('wavelet_name', "cmor")
        dx = x[1] - x[0]
        scales = scg.periods2scales(np.arange(1, 60))
        coefs, freqs = pywt.cwt(y, scales, wavelet='cmor', sampling_period=dx)
        return jsonify({
            "scales": scales.tolist(),
            "frequencies": freqs.tolist(),
            "coefficients_real": coefs.real.tolist(),
            "coefficients_imag": coefs.imag.tolist()
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/acf', methods=['POST'])
def acf():
    try:
        x, y = process_request()
        N = len(y)
        yc = y - np.mean(y)
        var = np.var(y)
        ACF = signal.fftconvolve(yc, yc[::-1], mode='same') / var
        lags = np.arange(-N // 2, N // 2)
        return jsonify({"lags": lags.tolist(), "acf": ACF.tolist()})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/hilbert', methods=['POST'])
def hilbert_transform():
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
        # Получение данных из запроса
        x, y = process_request()
        margin = request.json.get('margin', 0.2)  # Необязательный параметр (по умолчанию 0.2)
        order = request.json.get('order', 16)    # Необязательный параметр (по умолчанию 16)

        # Расширение данных с помощью метода Burg
        x_ext, y_ext, Nl, Nr = burg(x, y, margin, order)
        N = len(y)

        # Применение преобразования Гильберта
        S = signal.hilbert(y_ext, N + Nl + Nr)
        S = S[Nl: N + Nl]  # Убираем расширенные края
        Im = S.imag         # Мнимая часть
        Re = S.real         # Действительная часть

        # Возврат результата
        return jsonify({
            "real_part": Re.tolist(),
            "imaginary_part": Im.tolist()
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

        # Возврат результата
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
        margin = request.json.get('margin', 0.3)  # Необязательный параметр (по умолчанию 0.3)
        order = request.json.get('order', 16)    # Необязательный параметр (по умолчанию 16)

        # Расширение данных с помощью метода Burg
        x_ext, y_ext, Nl, Nr = burg(x, y, margin, order)
        N = len(y)

        # Вычисление аналитического сигнала
        S = signal.hilbert(y_ext, N + Nl + Nr)
        S = S[Nl: N + Nl]  # Убираем расширенные края
        A = np.abs(S)      # Амплитуда аналитического сигнала

        # Возврат результата
        return jsonify({
            "amplitude": A.tolist()
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)