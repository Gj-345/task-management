FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/auth-service .

FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata \
    && adduser -D -u 10001 app
USER app
COPY --from=build /out/auth-service /usr/local/bin/auth-service
EXPOSE 8080
ENTRYPOINT ["auth-service"]
