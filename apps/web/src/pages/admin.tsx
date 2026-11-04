import type {GetServerSideProps} from 'next';
export const getServerSideProps:GetServerSideProps=async()=>({redirect:{destination:'/platform',permanent:false}});
export default function AdminRedirect(){return null;}
