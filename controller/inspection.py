"""Controlador SIL: máquina de estados espera -> captura -> inferencia -> decision."""
import time

from transitions import Machine

from vision.detector import decode_png_b64, load_detector


class InspectionController:
    states = ["espera", "captura", "inferencia", "decision"]

    def __init__(self, detector=None):
        # Default comes from the DETECTOR env var (see vision/detector.py).
        self.detector = detector or load_detector()
        self._image = None
        self._result = None
        self.machine = Machine(model=self, states=self.states, initial="espera")
        self.machine.add_transition("capturar", "espera", "captura")
        self.machine.add_transition("inferir", "captura", "inferencia", after="_run_detector")
        self.machine.add_transition("decidir", "inferencia", "decision")
        self.machine.add_transition("reiniciar", "decision", "espera")

    def _run_detector(self):
        self._result = self.detector.predict(self._image)

    def process(self, captura: dict) -> dict:
        """Procesa un mensaje de captura y devuelve el mensaje de decisión."""
        t0 = time.perf_counter()
        self.capturar()
        self._image = decode_png_b64(captura["imagen_png_b64"])
        self.inferir()
        self.decidir()
        res = self._result
        decision = {
            "pieza_id": captura["pieza_id"],
            "timestamp": time.time(),
            "decision": "OK" if res["label"] == "ok" else "RECHAZO",
            "label": res["label"],
            "score": res["score"],
            "latencia_ms": (time.perf_counter() - t0) * 1000,
        }
        self.reiniciar()
        return decision
