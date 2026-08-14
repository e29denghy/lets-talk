#!/usr/bin/env python3
"""
AI 语音截断取证：分析历史会话双通道录音，定位 AI 音频被异常截断的时刻。

用法：
    python3 scripts/audio-forensics.py [会话id ...]   # 不传则分析全部
输出：
    - 每个会话的 AI 硬切断点（高能量 → 静音 <60ms）
    - 与 student.wav 能量对照：切断瞬间学生在说话（=真实打断）还是无声（=异常截断）
"""
import wave, glob, struct, os, sys

BASE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'storage/app/private/voice')


def load(path):
    try:
        w = wave.open(path)
        fr, n = w.getframerate(), w.getnframes()
        raw = w.readframes(n)
        return fr, struct.unpack(f'<{n}h', raw[:n * 2]) if n else ()
    except Exception:
        return None, None


def rms_series(vals, fr, win_ms=20):
    step = max(1, fr * win_ms // 1000)
    out = []
    for i in range(0, len(vals) - step, step):
        chunk = vals[i:i + step]
        out.append((sum(v * v for v in chunk) / step) ** 0.5)
    return out, step


def analyze(sid):
    f_ai = os.path.join(BASE, sid, 'ai.wav')
    if not os.path.exists(f_ai):
        return None
    fr_a, ai = load(f_ai)
    fr_s, st = load(os.path.join(BASE, sid, 'student.wav'))
    if not fr_a or not ai or len(ai) < fr_a * 2:
        return None

    a_rms, a_step = rms_series(ai, fr_a)
    med = sorted(a_rms)[len(a_rms) // 2] if a_rms else 0
    if med < 500:
        return None

    s_rms = s_step = s_med = None
    if fr_s and st:
        minlen = min(len(ai), len(st))
        a_rms, a_step = rms_series(ai[:minlen], fr_a)
        s_rms, s_step = rms_series(st[:minlen], fr_s)
        s_med = sorted(s_rms)[len(s_rms) // 2] if s_rms else 0

    cuts, barge = [], []
    for i in range(1, len(a_rms) - 3):
        if i >= len(a_rms) - int(fr_a / a_step):  # 跳过文件末尾 1s（会话结束收尾）
            break
        if a_rms[i] > 0.45 * med and a_rms[i + 1] < 0.15 * med and a_rms[i + 2] < 0.15 * med:
            t = i * a_step / fr_a
            cuts.append(t)
            if s_rms is not None and s_med:
                j = int(t * fr_s / s_step)
                win = s_rms[max(0, j - 8):min(len(s_rms), j + 25)]
                if win and max(win) > max(2000, 2.2 * s_med):
                    barge.append(t)

    spurious = [round(t, 1) for t in cuts if t not in barge]
    real = [round(t, 1) for t in barge]
    return {'cuts': len(cuts), 'real': len(barge), 'spurious': len(spurious),
            'real_t': real, 'spurious_t': spurious, 'dur': round(len(ai) / fr_a, 1)}


def main():
    sids = sys.argv[1:] or [os.path.basename(os.path.dirname(p)) for p in sorted(glob.glob(f'{BASE}/*/ai.wav'))]
    total_real = total_spurious = 0
    for sid in sids:
        r = analyze(sid)
        if not r:
            continue
        total_real += r['real']
        total_spurious += r['spurious']
        flag = '⚠ 存在异常截断' if r['spurious'] else '✓'
        print(f"会话 {sid}: 时长 {r['dur']}s · 硬切 {r['cuts']} 次（真实打断 {r['real']} / 异常 {r['spurious']}）{flag}")
        if r['real_t']:
            print(f"  真实打断时刻: {r['real_t']}")
        if r['spurious_t']:
            print(f"  异常截断时刻: {r['spurious_t']}")
    print(f"\n合计: 真实打断 {total_real} 次, 异常截断 {total_spurious} 次")


if __name__ == '__main__':
    main()
