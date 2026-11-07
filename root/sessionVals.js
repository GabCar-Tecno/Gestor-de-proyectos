(function () {
  window.ROOT_MIXINS.push({
    sessionVals(ctx){
      const { s, isDev, isPM } = ctx;
      const R={};
      R.isDev=isDev; R.isPM=isPM;
      R.showChecking = !s.authChecked;
      R.showLogin = s.authChecked && !s.session && !s.recoveryMode;
      R.showApp = s.authChecked && !!s.session && !s.recoveryMode;
      R.showRecovery = s.authChecked && s.recoveryMode;
      R.roleLabel = isPM ? 'PM' : isDev ? 'DEV' : 'CLIENTE';
      R.userInitials = s.session ? this.emailInitials(s.session.user.email) : '?';
      return R;
    },
    loginVals(ctx){
      const { s } = ctx;
      const R={};
      R.loginEmail=s.loginEmail; R.loginPassword=s.loginPassword;
      R.onLoginEmail=(e)=>this.onLoginEmail(e); R.onLoginPassword=(e)=>this.onLoginPassword(e);
      R.doLogin=(e)=>this.doLogin(e); R.doLogout=()=>this.doLogout();
      R.loginPassType = this.passwordInputType(s.showLoginPass);
      R.loginEyeHref = this.passwordToggleIcon(s.showLoginPass);
      R.toggleLoginPass=()=>this.toggleLoginPass();
      R.forgotPassword=()=>this.forgotPassword();
      R.loginError=s.loginError||''; R.loginErrShow=!!s.loginError;
      R.loginNotice=s.loginNotice||''; R.loginNoticeShow=!!s.loginNotice;
      R.loginLoading=!!s.loginLoading; R.loginBtnLabel=s.loginLoading?'Entrando…':'Entrar';
      return R;
    },
    recoveryVals(ctx){
      const { s } = ctx;
      const R={};
      R.recoveryPass1=s.recoveryPass1||''; R.recoveryPass2=s.recoveryPass2||'';
      R.onRecoveryPass1=(e)=>this.onRecoveryPass1(e); R.onRecoveryPass2=(e)=>this.onRecoveryPass2(e);
      R.doSetNewPassword=(e)=>this.doSetNewPassword(e);
      R.recoveryPass1Type = this.passwordInputType(s.showRecoveryPass1);
      R.recoveryPass2Type = this.passwordInputType(s.showRecoveryPass2);
      R.recoveryPass1EyeHref = this.passwordToggleIcon(s.showRecoveryPass1);
      R.recoveryPass2EyeHref = this.passwordToggleIcon(s.showRecoveryPass2);
      R.toggleRecoveryPass1=()=>this.toggleRecoveryPass1();
      R.toggleRecoveryPass2=()=>this.toggleRecoveryPass2();
      R.recoveryError=s.recoveryError||''; R.recoveryErrShow=!!s.recoveryError;
      R.recoveryLoading=!!s.recoveryLoading; R.recoveryBtnLabel=s.recoveryLoading?'Guardando…':'Guardar nueva contraseña';
      return R;
    }
  });
})();
