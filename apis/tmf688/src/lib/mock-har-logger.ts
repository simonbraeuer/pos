import { Observable, defer } from 'rxjs';
import { finalize, tap } from 'rxjs/operators';

const instrumentedInstances = new WeakSet<object>();

function inferHttpMethod(operationName: string): string {
  const name = operationName.toLowerCase();
  if (name.startsWith('get') || name.startsWith('list') || name.startsWith('search') || name.startsWith('validate')) {
    return 'GET';
  }
  if (name.startsWith('create') || name.startsWith('qualify') || name.startsWith('authenticate') || name.startsWith('refresh') || name.startsWith('manage') || name.startsWith('publish')) {
    return 'POST';
  }
  if (name.startsWith('update')) {
    return 'PATCH';
  }
  if (name.startsWith('delete') || name.startsWith('logout')) {
    return 'DELETE';
  }
  return 'POST';
}

function stringifyContent(value: unknown): string {
  if (value === undefined) {
    return '';
  }
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ value: String(value) });
  }
}

function sanitizeError(error: unknown): unknown {
  if (!error || typeof error !== 'object') {
    return error;
  }
  const err = error as { message?: string; status?: number; stack?: string };
  return {
    message: err.message,
    status: err.status,
    stack: err.stack,
  };
}

function statusTextFromCode(code: number): string {
  switch (code) {
    case 200:
      return 'OK';
    case 201:
      return 'Created';
    case 204:
      return 'No Content';
    case 400:
      return 'Bad Request';
    case 401:
      return 'Unauthorized';
    case 403:
      return 'Forbidden';
    case 404:
      return 'Not Found';
    case 409:
      return 'Conflict';
    case 500:
      return 'Internal Server Error';
    case 503:
      return 'Service Unavailable';
    default:
      return code >= 400 ? 'Error' : 'OK';
  }
}

/**
 * Instruments all observable-returning methods on a service instance.
 * A HAR-like log entry is written with `console.debug` on completion.
 */
export function instrumentMockHarLogging(
  instance: object,
  apiName: string,
  baseUrlPath: string
): void {
  if (instrumentedInstances.has(instance)) {
    return;
  }
  instrumentedInstances.add(instance);

  const prototype = Object.getPrototypeOf(instance) as Record<string, unknown>;
  for (const propertyName of Object.getOwnPropertyNames(prototype)) {
    if (propertyName === 'constructor') {
      continue;
    }

    const descriptor = Object.getOwnPropertyDescriptor(prototype, propertyName);
    if (!descriptor || typeof descriptor.value !== 'function') {
      continue;
    }

    const original = descriptor.value as (...args: unknown[]) => unknown;

    Object.defineProperty(instance, propertyName, {
      value: function wrappedMethod(...args: unknown[]): unknown {
        const method = inferHttpMethod(propertyName);
        const url = `${baseUrlPath}/${propertyName}`;
        const startedDateTime = new Date().toISOString();
        const startedAt = Date.now();
        const requestPayload = args.length <= 1 ? args[0] : args;
        const result = original.apply(this, args);

        if (!result || typeof (result as { pipe?: unknown }).pipe !== 'function') {
          return result;
        }

        let responseStatus = 200;
        let responseStatusText = 'OK';
        let responsePayload: unknown;

        return defer(() =>
          (result as Observable<unknown>).pipe(
            tap({
              next: (value) => {
                responsePayload = value;
              },
              error: (error: unknown) => {
                const status = (error as { status?: number } | undefined)?.status;
                responseStatus = typeof status === 'number' ? status : 500;
                responseStatusText = statusTextFromCode(responseStatus);
                responsePayload = sanitizeError(error);
              },
            }),
            finalize(() => {
              const duration = Date.now() - startedAt;
              const requestText = stringifyContent(requestPayload);
              const responseText = stringifyContent(responsePayload);
              const requestHeaders = {
                accept: 'application/json',
                'content-type': 'application/json',
                'x-mock-api': apiName,
              };
              const responseHeaders = {
                'content-type': 'application/json',
                'x-mock': 'true',
              };
              const isError = responseStatus >= 400;
              const requestLine = `${method} ${url} HTTP/1.1`;
              const responseLine = `HTTP/1.1 ${responseStatus} ${responseStatusText}`;

              const harLog = {
                log: {
                  version: '1.2',
                  creator: {
                    name: 'pos-mock-api',
                    version: '1.0.0',
                  },
                  entries: [
                    {
                      startedDateTime,
                      time: duration,
                      request: {
                        method,
                        url,
                        httpVersion: 'HTTP/1.1',
                        headers: [
                          { name: 'accept', value: 'application/json' },
                          { name: 'x-mock-api', value: apiName },
                        ],
                        queryString: [],
                        postData:
                          method === 'GET' || requestPayload === undefined
                            ? undefined
                            : {
                                mimeType: 'application/json',
                                text: requestText,
                              },
                        headersSize: -1,
                        bodySize: requestText.length,
                      },
                      response: {
                        status: responseStatus,
                        statusText: responseStatusText,
                        httpVersion: 'HTTP/1.1',
                        headers: [{ name: 'content-type', value: 'application/json' }],
                        content: {
                          size: responseText.length,
                          mimeType: 'application/json',
                          text: responseText,
                        },
                        redirectURL: '',
                        headersSize: -1,
                        bodySize: responseText.length,
                      },
                      cache: {},
                      timings: {
                        blocked: 0,
                        dns: -1,
                        connect: -1,
                        ssl: -1,
                        send: 0,
                        wait: duration,
                        receive: 0,
                      },
                      _mock: true,
                      _service: apiName,
                      _operation: propertyName,
                    },
                  ],
                },
              };

              const restRecord = {
                timestamp: startedDateTime,
                durationMs: duration,
                requestLine,
                requestHeaders,
                requestBody:
                  method === 'GET' || requestPayload === undefined
                    ? undefined
                    : JSON.parse(requestText),
                responseLine,
                responseHeaders,
                responseBody: responseText ? JSON.parse(responseText) : undefined,
                service: apiName,
                operation: propertyName,
                mock: true,
              };

              console.debug(
                `[${apiName.toUpperCase()}] ${requestLine} -> ${responseLine} (${duration}ms)`,
                {
                  ...restRecord,
                  har: harLog,
                  level: isError ? 'error' : 'debug',
                }
              );
            })
          )
        );
      },
      configurable: true,
      writable: true,
      enumerable: false,
    });
  }
}
