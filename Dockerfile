FROM node:20-alpine as simple-proxy
LABEL maintainer="slavianich@gmail.com"
WORKDIR /app
COPY . ./
EXPOSE 8000
CMD node ./lib/proxy.js
