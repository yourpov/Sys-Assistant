import type { ManualAction } from '../types';

export interface ManualActionDef {
  action : ManualAction;
  label  : string;
  hint   : string;
}

export const MANUAL_ACTIONS: ManualActionDef[] = [
  { 
    action : 'toggleValorant',
    label  : 'VALORANT',
    hint   : "Closes VALORANT if it's running, opens it otherwise"
  },
  {
    action : 'toggleRiotClient',
    label  : 'Riot Client',
    hint   : "Closes the Riot Client if it's running, opens it otherwise"
  },
  {
    action : 'OpenTraceX',
    label  : 'Open TraceX',
    hint   : 'Runs tracex.exe as administrator'
  },
  {
    action : 'changeSeed',
    label  : 'Change seed',
    hint   : 'Picks a new random emu seed'
  },
  {
    action : 'openEmuInstaller',
    label  : 'Open emu installer',
    hint   : 'Runs emu_installer.exe'
  },
  {
    action : 'openLoader',
    label  : 'Open the loader',
    hint   : 'Runs ldr.exe'
  },
  { 
    action : 'restartValorant',
    label  : 'Restart VALORANT',
    hint   : "Closes VALORANT if it's running, then opens it again"
  },
];
