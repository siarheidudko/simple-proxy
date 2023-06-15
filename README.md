# Simple proxy

A simple proxy server with access token verification and the ability to proxy unencrypted traffic. You probably shouldn't use this in production, but you can use it on the internal network or behind nginx with ssl.

## Setup

Add configuration settings (the default values are given):

- PROXY_KEY_FILE=/app/.keys - the path to the access keys (the server listens for changes)
- PROXY_PORT=8000 - the port of the proxy server
- PROXY_MAX_LISTENERS=0 - max listeners, 0 - unlimited
- REMOTE_HOST=google.com - host of the remote server
- REMOTE_PORT=80 - port of the remote server
- PROXY_WORKERS=4 - number of the workers

### Format of the key file

```txt
access_key_1
access_key_2
access_key_3
```

### Example of use in kubernetes

```yaml
apiVersion: v1
kind: Service
metadata:
  name: proxy-service
  namespace: proxy-system
  labels:
    app: proxy
spec:
  ports:
  - name: proxy-server
    port: 5000
    protocol: TCP
    targetPort: 5000
  selector:
    app: proxy
---
apiVersion: apps/v1
kind: Deployment
metadata:
  labels:
    app: proxy
    tier: proxy-server
  name: proxy-server
  namespace: proxy-system
spec:
  selector:
    matchLabels:
      app: proxy
      tier: proxy-server
  strategy:
    type: Recreate
  template:
    metadata:
      labels:
        app: proxy
        tier: proxy-server
    spec:
      containers:
      - name: proxy-server
        image: sergdudko/simple-proxy:latest
        env:
        - name: PROXY_KEY_FILE
          value: "/app/.keys"
        - name: PROXY_PORT
          value: "8000"
        - name: PROXY_MAX_LISTENERS
          value: "0"
        - name: REMOTE_HOST
          value: "google.com"
        - name: REMOTE_PORT
          value: "80"
        - name: PROXY_WORKERS
          value: "4"
        imagePullPolicy: IfNotPresent
        ports:
        - containerPort: 8000
          protocol: TCP
        resources:
          limits:
            cpu: 100m
            memory: 128Mi
        volumeMounts:
        - name: proxy-keys-storage
          mountPath: /app/.keys
          readOnly: true
      volumes:
      - name: proxy-keys-storage
        secret:
          secretName: proxy-keys
```

## Use

Use the `API-KEY` header for authorization, default token `00000000-0000-0000-0000-000000000000`.
