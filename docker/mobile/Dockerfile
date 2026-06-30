FROM cirrusci/flutter:3.24.0 AS builder

WORKDIR /app

COPY apps/mobile/pubspec.yaml apps/mobile/pubspec.lock* ./
RUN flutter pub get

COPY apps/mobile .

RUN flutter build apk --release

FROM alpine:latest

COPY --from=builder /app/build/app/outputs/flutter-apk/app-release.apk /output/leadhunter.apk
