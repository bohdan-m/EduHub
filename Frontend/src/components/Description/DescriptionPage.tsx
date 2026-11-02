type DescriptionPageProps = {
    header: string;
    description: string;
};

function DescriptionPage({ header, description }: DescriptionPageProps) {
    return (
        <section className="mt-4 grid items-center gap-3 border-y border-separator py-8 md:grid-cols-2 md:gap-8 md:py-12">
            <h1 className="m-0 text-[clamp(28px,4vw,40px)] font-semibold leading-tight tracking-tight text-balance">{header}</h1>
            <p className="m-0 max-w-[60ch] text-muted">{description}</p>
        </section>
    );
}

export default DescriptionPage;
