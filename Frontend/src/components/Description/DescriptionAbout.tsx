import styles from "./DescriptionAbout.module.css";

type DescriptionAboutProps = {
    header: string;
    description: string;
};

function DescriptionAbout({ header, description }: DescriptionAboutProps) {
    return (
        <div className={styles.container}>
            <h1 className={styles.header}>{header}</h1>
            <p className={styles.description}>{description}</p>
        </div>
    );
}

export default DescriptionAbout;
