(function () {
  'use strict';

  const workbench = document.getElementById('stackWorkbench');
  if (!workbench) return;

  const workflows = {
    analysis: {
      title: 'Reverse-engineering agent setup',
      summary: 'Task-specific agents connect source, binaries, symbols, and captures to build an evidence-linked picture of an unfamiliar graphics application.',
      inputs: 'Authorized code or binaries, symbols, engine documentation, frame captures.',
      output: 'Subsystem maps, annotated findings, and reproducible analysis tasks with source references.',
      gate: 'Engineers verify inferred behavior against code and runtime evidence.',
      layers: ['application', 'engine', 'shaders'],
      color: '#00d4ff'
    },
    patterns: {
      title: 'Graphics patterns in decompilation & recompilation',
      summary: 'AI-assisted analysis identifies engine-specific rendering structures in authorized game decompilation and recompilation work. Candidate matches remain hypotheses until verified.',
      inputs: 'Authorized game binaries, decompiler output, shader bytecode, API traces, and known engine patterns.',
      output: 'Candidate render loops, resource lifetimes, shader interfaces, and reconstruction notes linked to binary locations.',
      gate: 'Review pattern matches, rebuild relevant paths, and compare behavior and captured frames.',
      layers: ['application', 'engine', 'shaders', 'api'],
      color: '#eab976'
    },
    backport: {
      title: 'LLM-assisted graphics subsystem backports',
      summary: 'Adapt rendering subsystems to older engine branches or constrained targets with dependency analysis and reviewable implementation proposals.',
      inputs: 'Source and target branches, renderer dependencies, API capabilities, and hardware constraints.',
      output: 'Dependency maps, compatibility gaps, proposed patches, and a targeted regression plan.',
      gate: 'Engineers review changes; compilation, image comparisons, and performance tests run on the target.',
      layers: ['engine', 'shaders', 'api'],
      color: '#91d7ad'
    },
    trace: {
      title: 'Traceability across the graphics stack',
      summary: 'Connect an application-level symptom to engine code, render passes, API events, driver diagnostics, and GPU measurements without losing the investigation context.',
      inputs: 'Source references, logs, frame captures, API traces, driver diagnostics, and GPU counters where available.',
      output: 'An evidence chain from symptom to candidate cause, with missing observations and uncertainty explicitly recorded.',
      gate: 'Reproduce the issue and verify the proposed cause with targeted captures and measurements.',
      layers: ['application', 'engine', 'shaders', 'api', 'driver', 'hardware'],
      color: '#00d4ff'
    },
    qa: {
      title: 'Graphics pipeline QA automation',
      summary: 'Design repeatable build, capture, replay, and comparison tools. AI helps triage failures; explicit test thresholds determine pass or fail.',
      inputs: 'Test scenes, reference images, build configurations, target devices, and agreed performance budgets.',
      output: 'Image-difference reports, shader and API validation results, performance regressions, and linked failure artifacts.',
      gate: 'Investigate failures, approve intentional baseline changes, and retain test results for release review.',
      layers: ['application', 'engine', 'shaders', 'api', 'driver', 'hardware'],
      color: '#91d7ad'
    },
    execution: {
      title: 'Agentic pipeline execution & guardrails',
      summary: 'Orchestrate analysis, builds, captures, and QA through approved tools across the graphics stack. Bound each agent by tool permissions, isolated workspaces, and execution limits.',
      inputs: 'Task plans, approved tools, access policies, execution budgets, and required approval checkpoints.',
      output: 'Auditable run records with tool calls, artifacts, policy decisions, and checkpoint results.',
      gate: 'Pause on policy violations, failed checks, or budget limits. Require engineer approval for protected changes and release actions.',
      layers: ['application', 'engine', 'shaders', 'api', 'driver', 'hardware'],
      color: '#eab976'
    }
  };

  const buttons = [...workbench.querySelectorAll('[data-workflow]')];
  const layers = [...workbench.querySelectorAll('[data-layer]')];
  const fields = { title: 'workflowTitle', summary: 'workflowSummary', inputs: 'workflowInputs', output: 'workflowOutput', gate: 'workflowGate' };

  function selectWorkflow(key) {
    const workflow = workflows[key];
    if (!workflow) return;
    workbench.style.setProperty('--workflow-color', workflow.color);
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.workflow === key)));
    layers.forEach(layer => {
      const covered = workflow.layers.includes(layer.dataset.layer);
      layer.classList.toggle('is-covered', covered);
      layer.querySelector('.stack-coverage').textContent = covered ? 'AI coverage' : 'Context';
    });
    Object.entries(fields).forEach(([field, id]) => {
      document.getElementById(id).textContent = workflow[field];
    });
  }

  buttons.forEach(button => button.addEventListener('click', () => selectWorkflow(button.dataset.workflow)));
  selectWorkflow('analysis');
}());