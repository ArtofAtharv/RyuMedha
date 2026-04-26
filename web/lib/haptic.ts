export const haptic = (intensity: number = 20) => {
  if (typeof window !== 'undefined' && window.navigator.vibrate) {
    window.navigator.vibrate(intensity)
  }
}
