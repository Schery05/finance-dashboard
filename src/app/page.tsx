import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import DashboardClientPage from "./DashboardClientPage"; 

export default async function Page() {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  return <DashboardClientPage />;
}