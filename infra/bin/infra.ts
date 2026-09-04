#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { ContextforgeStack } from "../lib/infra-stack";

const app = new cdk.App();
new ContextforgeStack(app, "ContextforgeStack", {
  env: { region: "us-west-2" },
});
