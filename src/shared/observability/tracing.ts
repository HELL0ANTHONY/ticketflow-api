import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { NodeSDK } from "@opentelemetry/sdk-node";

import { env } from "#/config/env.js";

let sdk: NodeSDK | undefined;

export function startTracing(): void {
  if (!env.tracingEnabled || sdk !== undefined) {
    return;
  }

  diag.setLogger(
    new DiagConsoleLogger(),
    env.environment === "production" ? DiagLogLevel.ERROR : DiagLogLevel.WARN,
  );

  sdk = new NodeSDK({
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs": {
          enabled: false,
        },
      }),
    ],
    serviceName: env.serviceName,
    traceExporter: new OTLPTraceExporter({
      url: env.otelTraceExporterUrl,
    }),
  });

  sdk.start();
}

export async function shutdownTracing(): Promise<void> {
  if (sdk === undefined) {
    return;
  }

  await sdk.shutdown();
  sdk = undefined;
}
