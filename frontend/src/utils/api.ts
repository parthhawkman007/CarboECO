export const getApiUrl = (): string => {
  if (typeof window !== "undefined") {
    const url = process.env.NEXT_PUBLIC_API_URL;
    if (url) return url;
    
    if (window.location.hostname.includes("firebaseapp.com") || window.location.hostname.includes("web.app")) {
      return "https://carboeco-backend-570867036028.asia-south1.run.app";
    }
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
};

export const getWsUrl = (): string => {
  const apiUrl = getApiUrl();
  return apiUrl.replace(/^http/, "ws");
};
