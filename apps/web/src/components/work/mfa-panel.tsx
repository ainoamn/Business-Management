import {useWorkspace} from './context';
import {MfaSettings} from '../mfa-settings';
export function MfaPanel(){const {session,locale,refreshSession}=useWorkspace();return session?<MfaSettings namespace="work" csrf={session.csrf} locale={locale} onSessionRefresh={refreshSession}/>:null;}
