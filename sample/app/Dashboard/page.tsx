import { fetchDashboardData } from "@/app/actions/academic";
import DashboardContent from "./DashboardContent";
import { redirect } from "next/navigation";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ sem?: string }> }) {
  const { sem } = await searchParams;
  const data = await fetchDashboardData();
  
  if (!data || !data.programId) {
    redirect("/Dashboard/UserProfile");
  }

  // If semester is missing from URL, redirect to user's current semester
  if (!sem && data.currentSemId) {
    redirect(`/Dashboard?sem=${data.currentSemId}`);
  }

  return <DashboardContent data={data} />;
}