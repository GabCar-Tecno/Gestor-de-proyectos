(function () {
  const { ROLE, THEME, LOCALE, PASSWORD_INPUT, PASSWORD_ICON, PASSWORD_MIN_LENGTH, MODAL, MODAL_MODE, TABLE } = window.APP_CONSTANTS;

  window.ROOT_MIXINS.push({
    async afterLogin(){
      const uid=this.state.session.user.id;
      const { data:prof } = await this._sb.from(TABLE.profiles).select('*').eq('id',uid).maybeSingle();
      const { data:profiles, error:profilesError } = await this._sb.from(TABLE.profiles).select('*');
      const profileRows=(profiles||[]).slice();
      if(prof&&!profileRows.some(x=>x.id===prof.id)) profileRows.push(prof);
      const labelOf=x=>{
        const first=x.first_name||x.firstname||x.nombres||'';
        const last=x.last_name||x.lastname||x.apellidos||'';
        return String(x.display_name||x.full_name||x.nombre_completo||x.name||x.nombre||x.user_name||x.username||([first,last].filter(Boolean).join(' '))||x.email||'').trim();
      };
      const profilesByRole=role=>profileRows.filter(x=>String(x.role_id||x.role||'').trim().toLowerCase()===role).map(x=>({id:x.id,label:labelOf(x)}))
        .filter(x=>x.id&&x.label).filter((x,i,a)=>a.findIndex(y=>y.label.toLowerCase()===x.label.toLowerCase())===i).sort((a,b)=>a.label.localeCompare(b.label,LOCALE));
      const devProfiles=profilesByRole(ROLE.dev);
      const pmProfiles=profilesByRole(ROLE.pm);
      if(profilesError) console.warn('No se pudieron cargar los perfiles de desarrollo:',profilesError.message);
      const profileRole=prof ? (prof.role_id || prof.role) : ROLE.client;
      const currentUserName=(prof&&labelOf(prof))||this.state.session.user.email||'';
      this.setState({profileRole, devProfiles, pmProfiles, currentUserName});
      this.applyRoleThemeUnlessUserChose(profileRole);
      await this.loadData();
    },
    isDev(){ return this.state.profileRole===ROLE.dev||this.isPM(); },
    isPM(){ return this.state.profileRole===ROLE.pm; },
    onLoginEmail(e){ this.setState({loginEmail:e.target.value}); },
    onLoginPassword(e){ this.setState({loginPassword:e.target.value}); },
    async doLogin(e){
      e.preventDefault();
      if(this._busy) return; this._busy=true;
      try{ await this._doLogin(); } finally{ this._busy=false; }
    },
    async _doLogin(){
      const email=(this.state.loginEmail||'').trim(), password=this.state.loginPassword||'';
      if(!email||!password){ this.setState({loginError:'Ingresa correo y contraseña.'}); return; }
      this.setState({loginLoading:true, loginError:''});
      const { error } = await this._sb.auth.signInWithPassword({email,password});
      this.setState({loginLoading:false});
      if(error) this.setState({loginError:'Credenciales inválidas.'});
    },
    async doLogout(){
      if(this._busy) return; this._busy=true;
      try{ await this._sb.auth.signOut(); } finally{ this._busy=false; }
    },
    async forgotPassword(){
      if(this._busy) return; this._busy=true;
      try{ await this._forgotPassword(); } finally{ this._busy=false; }
    },
    async _forgotPassword(){
      const email=(this.state.loginEmail||'').trim();
      if(!email){ this.setState({loginError:'Escribe tu correo arriba y da clic otra vez en "¿Olvidaste tu contraseña?".', loginNotice:''}); return; }
      this.setState({loginLoading:true, loginError:'', loginNotice:''});
      const redirectTo = window.location.href.split('#')[0].split('?')[0];
      const { error } = await this._sb.auth.resetPasswordForEmail(email, { redirectTo });
      this.setState({loginLoading:false});
      if(error) this.setState({loginError:'No se pudo enviar: '+error.message});
      else this.setState({loginNotice:'Listo, revisa tu correo para el enlace de recuperación.'});
    },
    onRecoveryPass1(e){ this.setState({recoveryPass1:e.target.value}); },
    onRecoveryPass2(e){ this.setState({recoveryPass2:e.target.value}); },
    toggleLoginPass(){ this.setState(s=>({showLoginPass:!s.showLoginPass})); },
    toggleRecoveryPass1(){ this.setState(s=>({showRecoveryPass1:!s.showRecoveryPass1})); },
    toggleRecoveryPass2(){ this.setState(s=>({showRecoveryPass2:!s.showRecoveryPass2})); },
    passwordInputType(shown){ return shown?PASSWORD_INPUT.shown:PASSWORD_INPUT.hidden; },
    passwordToggleIcon(shown){ return shown?PASSWORD_ICON.shown:PASSWORD_ICON.hidden; },
    toggleModalShowPass(key){ this.setState(s=>({modalShowPass:{...s.modalShowPass,[key]:!s.modalShowPass[key]}})); },
    async doSetNewPassword(e){
      e.preventDefault();
      if(this._busy) return; this._busy=true;
      try{ await this._doSetNewPassword(); } finally{ this._busy=false; }
    },
    async _doSetNewPassword(){
      const p1=this.state.recoveryPass1||'', p2=this.state.recoveryPass2||'';
      if(p1.length<PASSWORD_MIN_LENGTH){ this.setState({recoveryError:'Mínimo 6 caracteres.'}); return; }
      if(p1!==p2){ this.setState({recoveryError:'Las contraseñas no coinciden.'}); return; }
      this.setState({recoveryLoading:true, recoveryError:''});
      const { error } = await this._sb.auth.updateUser({password:p1});
      this.setState({recoveryLoading:false});
      if(error){ this.setState({recoveryError:error.message}); return; }
      this.setState({recoveryMode:false, recoveryPass1:'', recoveryPass2:''});
      await this.afterLogin();
    },
    openPasswordModal(){ this.setState({modal:{type:MODAL.password,mode:MODAL_MODE.edit,title:'Cambiar contraseña'}, form:{newPassword:'',confirmPassword:''}}); },
    toggleUserMenu(){ this.setState(s=>({userMenuOpen:!s.userMenuOpen})); },
    toggleDarkMode(){
      const on=document.documentElement.classList.toggle(THEME.darkClass);
      try{ localStorage.setItem(THEME.storageKey,on?THEME.dark:THEME.light); }catch(e){}
      this.setState({darkMode:on});
    },
    applyRoleThemeUnlessUserChose(role){
      let chosen=null; try{ chosen=localStorage.getItem(THEME.storageKey); }catch(e){}
      if(chosen) return;
      const theme=role===ROLE.dev?THEME.dark:THEME.light;
      try{ localStorage.setItem(THEME.defaultStorageKey,theme); }catch(e){}
      const on=document.documentElement.classList.toggle(THEME.darkClass,theme===THEME.dark);
      this.setState({darkMode:on});
    },
    closeUserMenu(){ this.setState({userMenuOpen:false}); },
    openPasswordModalFromMenu(){ this.setState({userMenuOpen:false}); this.openPasswordModal(); },
  });
})();
