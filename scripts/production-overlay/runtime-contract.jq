{
  serviceAccountName: .spec.serviceAccountName,
  containerConcurrency: .spec.containerConcurrency,
  timeoutSeconds: .spec.timeoutSeconds,
  containers: (.spec.containers | map({
    image: .image,
    env: .env,
    resources: .resources,
    ports: .ports,
    startupProbe: .startupProbe
  })),
  minScale: (.metadata.annotations["autoscaling.knative.dev/minScale"] // null),
  maxScale: (.metadata.annotations["autoscaling.knative.dev/maxScale"] // null),
  cpuThrottling: (.metadata.annotations["run.googleapis.com/cpu-throttling"] // null)
}

