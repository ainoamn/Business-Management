import {useRouter} from 'next/router';
import {PlatformConsole} from '../../components/platform/console';
export default function PlatformPage() {const router=useRouter();const section=Array.isArray(router.query.section)?router.query.section[0]:undefined;return <PlatformConsole section={section??'overview'}/>;}
