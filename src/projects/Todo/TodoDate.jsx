import { useEffect, useState } from "react";

const formatNow = () => {
    const now = new Date();
    return `${now.toLocaleDateString()} - ${now.toLocaleTimeString()}`;
};

export const TodoDate = () => {
    const [dateTime, setDateTime] = useState(formatNow);
    useEffect(() => {
        const interval = setInterval(()=>{
            setDateTime(formatNow());
        }, 1000);

        return () => clearInterval(interval);

    }, []);
    return (
        <h2 className="date-time">{dateTime}</h2>
    )
}
