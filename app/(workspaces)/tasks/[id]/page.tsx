type TaskDetailsPageProps = {
  params: Promise<{ id: string }>;
};

export default async function TaskDetailsPage({ params }: TaskDetailsPageProps) {
  const { id } = await params;

  return (
    <main className="min-h-screen bg-[#080d14] p-6 text-[#f2f5fa] md:p-10">
      <section className="mx-auto max-w-3xl rounded-3xl border border-[#262e3d] bg-[#171c26] p-8">
        <h1 className="text-3xl">Job Details</h1>
        <p className="mt-4 text-[#8c9eba]">Route param captured from folder structure.</p>
        <p className="mt-6 rounded-xl border border-[#262e3d] bg-[#1a212e] px-4 py-3 text-[#b8c4d6]">
          Current job id: {id}
        </p>
      </section>
    </main>
  );
}
