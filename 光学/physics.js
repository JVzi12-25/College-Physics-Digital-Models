const RAD = Math.PI / 180; // degree conversion for the canvas controls

export function refract(n1, n2, incidentDeg) {
  const theta1 = incidentDeg * RAD;
  const ratio = (n1 / n2) * Math.sin(theta1);
  if (Math.abs(ratio) > 1) {
    return { reflected: true, theta2: null, criticalDeg: criticalAngle(n1, n2) };
  }
  return { reflected: false, theta2: Math.asin(Math.max(-1, Math.min(1, ratio))) / RAD, criticalDeg: criticalAngle(n1, n2) };
}

export function criticalAngle(n1, n2) {
  return n1 > n2 ? Math.asin(n2 / n1) / RAD : null;
}

export function thinLens(f, objectDistance) {
  if (Math.abs(objectDistance - f) < 1e-9) return { imageDistance: Infinity, magnification: -Infinity, kind: "infinity" };
  const imageDistance = 1 / (1 / f - 1 / objectDistance);
  const magnification = -imageDistance / objectDistance;
  return { imageDistance, magnification, kind: imageDistance > 0 ? "real" : "virtual" };
}

export function doubleSlitIntensity(y, lambda, slitSeparation, screenDistance) {
  const sinTheta = y / Math.hypot(y, screenDistance);
  const phase = Math.PI * slitSeparation * sinTheta / lambda;
  return Math.cos(phase) ** 2;
}

export function doubleSlitFringeSpacing(lambda, slitSeparation, screenDistance) {
  return lambda * screenDistance / slitSeparation;
}

export function singleSlitIntensity(y, lambda, slitWidth, screenDistance) {
  const sinTheta = y / Math.hypot(y, screenDistance);
  const beta = Math.PI * slitWidth * sinTheta / lambda;
  if (Math.abs(beta) < 1e-8) return 1;
  return (Math.sin(beta) / beta) ** 2;
}

export function singleSlitMinimaAngle(order, lambda, slitWidth) {
  const ratio = order * lambda / slitWidth;
  return Math.abs(ratio) <= 1 ? Math.asin(ratio) / RAD : null;
}
