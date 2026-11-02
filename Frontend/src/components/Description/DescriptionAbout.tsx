type DescriptionAboutProps = {
    header: string;
    description: string;
};

function DescriptionAbout({ header, description }: DescriptionAboutProps) {
    return (
        <div className="mt-14">
            <h2 className="m-0 mb-2 text-[clamp(24px,3vw,30px)] font-semibold">{header}</h2>
            <p className="m-0 max-w-[70ch] whitespace-pre-line text-muted">{description}</p>
        </div>
    );
}

export default DescriptionAbout;
