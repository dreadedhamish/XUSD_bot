// axiosConfig.js
const axios = require('axios');
const { setupCache } = require('axios-cache-interceptor');
const axiosRetry = require('axios-retry').default;

// Create an axios instance with timeout configuration
const axiosInstance = axios.create({
  timeout: 5000, // Set timeout to 5000 milliseconds (5 seconds)
});
const cachedAxiosInstance = setupCache(axiosInstance);

// Configure axios-retry
axiosRetry(cachedAxiosInstance, {
  retries: 3,
  shouldResetTimeout: true,
  retryCondition: (e) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(e) || e?.code === 'ECONNABORTED';
  },
  onRetry: function onRetry(retryCount, error, requestConfig) {
    console.info(`Retry #${retryCount} to '${requestConfig.url}' because of ${error.message}`);
    return;
  },
});

// Add a request interceptor
cachedAxiosInstance.interceptors.request.use(request => {
  console.info(`Starting request to ${request.url}`);
  return request;
});

// Add a response interceptor
cachedAxiosInstance.interceptors.response.use(
  response => {
    console.info(`Request to ${response.config.url} succeeded`);
    console.info('Response data:', response.data);
    return response;
  },
  error => {
    if (error.code === 'ECONNABORTED') {
      console.error(`Request to ${error.config.url} timed out`);
    } else {
      console.error(`Request to ${error.config.url} failed: ${error.message}`);
    }
    return Promise.reject(error);
  }
);

module.exports = cachedAxiosInstance;