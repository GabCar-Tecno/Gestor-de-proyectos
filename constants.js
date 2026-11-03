(function () {
  const deepFreeze = (value) => {
    Object.values(value).forEach((child) => {
      if (child && typeof child === 'object') deepFreeze(child);
    });
    return Object.freeze(value);
  };

  const estimationPhase = { created: 'creada', sent: 'enviada', approved: 'aprobada' };
  const inputType = { text: 'text', password: 'password', date: 'date', number: 'number' };
  const deployableKind = { api: 'api', app: 'app', gateway: 'gateway' };
  const reqStatus = {
    estimation: 'estimacion',
    development: 'desarrollo',
    qa: 'qa',
    users: 'usuarios',
    production: 'produccion',
    estimationFallback: 'Estimacion'
  };
  const estimationActivityType = {
    analysis: 'analisis',
    development: 'desarrollo',
    architecture: 'arquitectura',
    qa: 'qa',
    manuals: 'manuales',
    management: 'gestion'
  };
  const icon = {
    api: '#ic-api',
    book: '#ic-book',
    chart: '#ic-chart',
    check: '#ic-check',
    copy: '#ic-copy',
    diagram: '#ic-diagram',
    expand: '#ic-expand',
    external: '#ic-ext',
    eye: '#ic-eye',
    eyeOff: '#ic-eye-off',
    file: '#ic-file',
    fileText: '#ic-filetext',
    image: '#ic-image',
    userGuide: '#ic-userguide',
    x: '#ic-x'
  };
  const emailField = { to: 'to', cc: 'cc' };

  window.APP_CONSTANTS = deepFreeze({
    VIEW: {
      companies: 'empresas',
      projects: 'proyectos',
      project: 'proyecto',
      requirements: 'requerimientos',
      requirement: 'requerimiento',
      apiDoc: 'apidoc',
      settings: 'configuracion',
      master: 'maestro',
      estimations: 'estimaciones',
      estimation: 'estimacion'
    },
    REQ_TAB: { documents: 'documentos', deployments: 'despliegues', blockers: 'bloqueantes' },
    API_TAB: { url: 'url', json: 'json' },
    PROJECTS_VIEW: { grid: 'grid', list: 'list' },
    FILTER_ALL: 'todos',
    ROLE: { dev: 'dev', pm: 'pm', client: 'client' },
    SAVE_STATUS: { idle: 'idle', saving: 'saving', saved: 'saved', error: 'error' },
    SEND_STATUS: { idle: 'idle', sending: 'sending', error: 'error' },
    THEME: {
      storageKey: 'gp-theme',
      defaultStorageKey: 'gp-theme-default',
      dark: 'dark',
      light: 'light',
      darkClass: 'dark-mode'
    },
    LOCALE: 'es-CO',
    NARROW_MAX_WIDTH: 760,
    PASSWORD_INPUT: { shown: inputType.text, hidden: inputType.password },
    ICON: icon,
    PASSWORD_ICON: { shown: icon.eyeOff, hidden: icon.eye },
    PASSWORD_MIN_LENGTH: 6,
    ESTIMATION_PHASE: estimationPhase,
    ESTIMATION_PHASE_ORDER: [estimationPhase.created, estimationPhase.sent, estimationPhase.approved],
    ESTIMATION_DECIMAL_OPTIONS: [0, 1, 2, 3, 4],
    ESTIMATION_LINE_KIND: { activity: 'activity', section: 'section' },
    ESTIMATION_ACTIVITY_TYPE: estimationActivityType,
    ESTIMATION_DEFAULTS: {
      versionLabel: 'V1',
      complexityId: 'baja',
      activityTypeId: estimationActivityType.development,
      roundingDecimals: '1',
      alertRatio: '0.3',
      dailyHours: '8',
      dedicationPct: '62.5',
      formatVersion: '4.0',
      duplicateVersionLabel: 'V2'
    },
    ESTIMATION_MAX_DAILY_HOURS: 100,
    MODAL: {
      notice: 'aviso',
      password: 'password',
      company: 'empresa',
      project: 'proyecto',
      requirement: 'requerimiento',
      masterReadOnly: 'maestroLectura',
      document: 'documento',
      deployment: 'despliegue',
      blocker: 'bloqueante',
      projectDeployments: 'desplieguesProy',
      viewDeployment: 'verDespliegue',
      resource: 'recurso',
      githubLinks: 'githubLinks',
      viewGithubLinks: 'verGithubLinks',
      credentials: 'credenciales',
      environment: 'ambiente',
      server: 'servidor',
      instruction: 'instruccion',
      contact: 'contacto',
      deployable: 'desplegable',
      components: 'componentes',
      email: 'correo',
      promoteConfirm: 'promoteConfirm',
      batchPromote: 'batchPromote',
      discord: 'discord'
    },
    MODAL_MODE: { create: 'crear', edit: 'editar' },
    FIELD_KIND: { text: 'text', area: 'area', select: 'select', checklist: 'checklist', codes: 'codes' },
    INPUT_TYPE: inputType,
    TABLE: {
      companies: 'companies',
      companyContacts: 'company_contacts',
      companyServers: 'company_servers',
      deployables: 'deployables',
      deployableInstructions: 'deployable_instructions',
      deploymentInstructions: 'deployment_instructions',
      environments: 'environments',
      estimations: 'estimations',
      estimationLines: 'estimation_lines',
      estimationComplexities: 'estimation_complexities',
      estimationActivityTypes: 'estimation_activity_types',
      profiles: 'profiles',
      projects: 'projects',
      projectCredentials: 'project_credentials',
      projectDeployables: 'project_deployables',
      projectDeployments: 'project_deployments',
      projectGithubLinks: 'project_github_links',
      requirements: 'requirements',
      requirementBlockers: 'requirement_blockers',
      requirementCodes: 'requirement_codes',
      requirementDeployments: 'requirement_deployments',
      requirementDocuments: 'requirement_documents',
      statuses: 'statuses'
    },
    STORAGE: {
      requirementDocuments: 'requirement-documents',
      urlPrefix: 'storage://',
      signedUrlTtlSeconds: 300,
      defaultContentType: 'application/octet-stream'
    },
    FILE_NAME: {
      estimationPrefix: 'estimacion-',
      requirementsPrefix: 'requerimientos-',
      unnamedEstimation: 'sin-nombre',
      uploadFallback: 'documento'
    },
    NEW_TAB: { target: '_blank', blankUrl: 'about:blank', rel: 'noopener noreferrer' },
    LOCAL_DATE_SUFFIX: 'T00:00:00',
    DELAY_MS: { redocRender: 90, copiedFeedback: 1500, printDialog: 300 },
    COPY_KEY: {
      emailBody: 'correo-cuerpo',
      projectDeploymentPrefix: 'p:',
      credentialPrefix: 'cred:',
      viewDeploymentVersionPrefix: 'vd-version-',
      viewDeploymentUrlPrefix: 'vd-url-',
      viewGithubLinkPrefix: 'vgh-',
      githubLinkRowPrefix: 'ghrow-'
    },
    SHOW_PASS_KEY: { credentialRowPrefix: 'cred-' },
    TEXT_LIST_TYPE: { ordered: 'ordered', bulleted: 'bulleted' },
    EDGE_FUNCTION: { discordNotify: 'discord-notify' },
    AUTH_EVENT: { passwordRecovery: 'PASSWORD_RECOVERY' },
    ID_PREFIX: {
      company: 'e',
      project: 'p',
      requirement: 'r',
      requirementCode: 'rc',
      document: 'd',
      deployment: 'x',
      blocker: 'b',
      githubLink: 'gl',
      credential: 'cred',
      environment: 'env',
      server: 'srv',
      instruction: 'ins',
      contact: 'cto',
      deployable: 'dep',
      estimation: 'est',
      estimationLine: 'eln'
    },
    REQ_STATUS: reqStatus,
    BOARD_RANK: {
      byStatus: {
        [reqStatus.development]: 0,
        [reqStatus.qa]: 0,
        [reqStatus.users]: 1,
        [reqStatus.estimation]: 2,
        [reqStatus.production]: 4
      },
      other: 3
    },
    MASTER_STATUS_GROUP: {
      estimation: 'estimacion',
      development: 'desarrollo',
      userTesting: 'usuario',
      production: 'produccion',
      blocked: 'bloqueado',
      other: 'otros'
    },
    STATUS_LABEL_HINT: {
      blocked: 'bloq',
      development: 'desarroll',
      userTesting: 'usuario',
      testing: 'prueba',
      qa: 'qa',
      production: 'prod',
      productionStrict: 'produ',
      estimation: 'estim',
      estimationStrict: 'estimaci'
    },
    REQ_CODE_FALLBACK: { prefix: 'REQ-', width: 3, pad: '0' },
    DEPLOYABLE_KIND: deployableKind,
    EMAIL_KIND_FILTER: { api: deployableKind.api, gateway: deployableKind.gateway, both: 'ambos' },
    EMAIL_FIELD: emailField,
    EMAIL_PANEL: { to: emailField.to, cc: emailField.cc, others: 'otros' },
    MAILTO_WARN_LENGTH: 1900,
    CREDENTIAL_GROUP: { environment: 'env', general: 'general' },
    DB_DEFAULT: {
      companyColor: 'linear-gradient(135deg,#5b6bff,#35c0f0)',
      companyInitial: '?',
      deployableKind: deployableKind.api,
      owner: 'Sin asignar',
      documentType: 'Documento',
      deploymentVersion: '—'
    },
    SHORT_DAY_MONTH: { day: '2-digit', month: 'short' },
    MS_PER_DAY: 86400000,
    EXCEL: {
      extension: '.xlsx',
      epochUtc: Date.UTC(1899, 11, 30),
      dateFormat: 'dd/mm/yyyy',
      dateTimeFormat: 'dd/mm/yyyy hh:mm',
      percentFormat: '0.0%',
      numberCellType: 'n'
    },
    PRINT_COLOR: {
      text: '#1f2937',
      paper: '#fff',
      panel: '#eef1f5',
      panelBorder: '#d4dbe4',
      label: '#475569',
      brand: '#102a70',
      faint: '#94a3b8',
      accent: '#087f9f',
      muted: '#64748b',
      headBorder: '#cbd3df',
      rowBorder: '#e5e9f0',
      sectionBg: '#f3f6fa',
      alert: '#e05252',
      highlightBg: '#e8f4fb'
    }
  });
})();
