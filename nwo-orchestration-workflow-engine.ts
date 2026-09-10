import { WorkflowEnvelopeSchema } from "beast-contracts/orchestration";
import { publishEvent } from "../data/EventPublisher";

export class OrchestrationWorkflowEngine {
  constructor(steps) {
    this.steps = steps; // { stepName: (context) => newContext }
  }

  run(workflowEnvelope) {
    const valid = WorkflowEnvelopeSchema.safeParse(workflowEnvelope);
    if (!valid.success) {
      const errorPacket = {
        id: crypto.randomUUID(),
        envelope: workflowEnvelope,
        reason: valid.error.message,
        rejectedAt: new Date().toISOString()
      };

      publishEvent("orchestration.workflow.rejected", errorPacket);
      throw new Error("Invalid workflow envelope");
    }

    let context = valid.data.initialContext;

    for (const stepName of valid.data.steps) {
      const step = this.steps[stepName];
      if (!step) {
        throw new Error(`Undefined workflow step: ${stepName}`);
      }

      context = step(context);

      publishEvent("orchestration.workflow.step", {
        id: crypto.randomUUID(),
        stepName,
        context,
        executedAt: new Date().toISOString()
      });
    }

    const completionPacket = {
      id: crypto.randomUUID(),
      workflowId: valid.data.workflowId,
      finalContext: context,
      completedAt: new Date().toISOString()
    };

    publishEvent("orchestration.workflow.completed", completionPacket);

    return context;
  }
}
