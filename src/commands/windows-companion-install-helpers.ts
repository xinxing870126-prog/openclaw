import { formatWindowsCompanionServiceDescription } from "../daemon/constants.js";
import { resolveWindowsCompanionProgramArguments } from "../daemon/program-args.js";
import { buildWindowsCompanionServiceEnvironment } from "../daemon/service-env.js";

export type WindowsCompanionInstallPlan = {
  programArguments: string[];
  workingDirectory?: string;
  environment: Record<string, string | undefined>;
  description?: string;
};

export async function buildWindowsCompanionInstallPlan(params: {
  env: Record<string, string | undefined>;
  shellAppLabel?: string;
  devMode?: boolean;
}): Promise<WindowsCompanionInstallPlan> {
  const { programArguments, workingDirectory } = await resolveWindowsCompanionProgramArguments({
    dev: params.devMode,
  });
  const environment = buildWindowsCompanionServiceEnvironment({
    env: params.env,
    shellAppLabel: params.shellAppLabel,
  });
  const description = formatWindowsCompanionServiceDescription({
    profile: params.env.OPENCLAW_PROFILE,
    version: environment.OPENCLAW_SERVICE_VERSION,
  });
  return { programArguments, workingDirectory, environment, description };
}
