import styles from "./DescriptionPage.module.css";

type DescriptionPageProps = {
    header: string;
    description: string;
};

function DescriptionPage({ header, description }: DescriptionPageProps) {
    return (
        <>
            <div className={styles.line}/>
            <div className={styles.container}>
                <h1 className={styles.header}>{header}</h1>
                <p className={styles.description}>{description}</p>
            </div>
            <div className={styles.line}/>
        </>
    );
}

export default DescriptionPage;
