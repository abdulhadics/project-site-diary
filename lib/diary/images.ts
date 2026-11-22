export function cameraFrame(video: HTMLVideoElement): HTMLCanvasElement {
  if (!video.videoWidth || !video.videoHeight) throw new Error("Wait for the live camera to start.");
  const scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The camera frame could not be read.");
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function jpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("The photo could not be saved.")), "image/jpeg", quality);
  });
}

export async function resizePhoto(blob: Blob, edge: number, quality: number): Promise<Blob> {
  const source = URL.createObjectURL(blob);
  const canvas = document.createElement("canvas");
  try {
    const image = new Image();
    image.src = source;
    await image.decode();
    const scale = Math.min(1, edge / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("The photo could not be processed.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await jpeg(canvas, quality);
  } finally {
    canvas.width = canvas.height = 0;
    URL.revokeObjectURL(source);
  }
}

export function imageBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result);
      resolve(data.slice(data.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function freshLocation(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Location is unavailable in this browser. Open the diary in Safari or Chrome over HTTPS."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, (error) => {
      const message = error.code === error.PERMISSION_DENIED
        ? "Location is required. In Safari, open the site menu → Website Settings → Location → Allow. In Chrome, open Site settings and allow Location. Also enable Location Services in your phone settings."
        : "A fresh location could not be found. Step outside or enable precise location, then try again.";
      reject(new Error(message));
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 12_000 });
  });
}
