// /assets/js/pages/dotnet_demo.js
(() => {
    console.log('[dotnet_demo.page] chargé');
  
    // IMPORTANT : Nom que page-hub reconnaît pour "dotnet_demo"
    // (DotnetDemo / dotnetDemo / DotnetDemoPage, etc.)
    window.DotnetDemo = {
      init(container) {
        console.log('[dotnet_demo.page] init');
        // Déléguer à votre bootloader déjà présent
        try {
          if (window.DotNetBoot && typeof window.DotNetBoot.init === 'function') {
            window.DotNetBoot.init(container);
          }
        } catch (e) {
          console.warn('[dotnet_demo.page] DotNetBoot.init error', e);
        }
        // Optionnel : auto-ouvrir la modale si souhaité
        // try { window.DotNetBoot?.openModal?.(); } catch {}
      },
  
      destroy() {
        console.log('[dotnet_demo.page] destroy');
        try { window.DotNetBoot?.destroy?.(); } catch {}
      }
    };
  })();
  