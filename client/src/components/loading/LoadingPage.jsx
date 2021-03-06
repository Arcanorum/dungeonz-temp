import React, { useEffect, useState } from "react";
import PubSub from "pubsub-js";
import playButtonBorder from "../../assets/images/misc/play-button-border.png";
import "./LoadingPage.scss";
import { LOADING, LOAD_PROGRESS, LOAD_FILE_PROGRESS } from "../../shared/EventTypes";
import { ApplicationState } from "../../shared/state/States";
import Utils from "../../shared/Utils";
import Hints from "./Hints";

function LoadingBar() {
    const [progress, setProgress] = useState("0%");
    const [fileName, setFileName] = useState("");

    useEffect(() => {
        const subs = [
            PubSub.subscribe(LOAD_PROGRESS, (msg, data) => {
                setProgress(`${Math.floor(data * 100)}%`);
            }),
            PubSub.subscribe(LOAD_FILE_PROGRESS, (msg, data) => {
                setFileName(data);
            }),
        ];

        // Cleanup.
        return () => {
            subs.forEach((sub) => {
                PubSub.unsubscribe(sub);
            });
        };
    }, []);

    return (
        <div className="progress-bar">
            <div className="filled" style={{ width: progress }} />
            <div className="info">
                <div className="percent">{progress}</div>
                <div className="file-name">{`( ${fileName} )`}</div>
            </div>
        </div>
    );
}

function LoadingPage() {
    const [randomHints] = useState(Utils.getShuffledArray(Hints));
    const [currentHintIndex, setCurrentHintIndex] = useState(0);
    const [hint, setHint] = useState(randomHints[currentHintIndex]);
    const [loading, setLoading] = useState(ApplicationState.loading);

    useEffect(() => {
        const subs = [
            PubSub.subscribe(LOADING, (msg, data) => {
                setLoading(data.new);
            }),
        ];

        // Cleanup.
        return () => {
            subs.forEach((sub) => {
                PubSub.unsubscribe(sub);
            });
        };
    }, []);

    useEffect(() => {
        setHint(randomHints[currentHintIndex]);
    }, [currentHintIndex]);

    const nextHintPressed = () => {
        if (currentHintIndex === randomHints.length - 1) {
            // Reset back to the start of the hints list.
            setCurrentHintIndex(0);
        }
        else {
            setCurrentHintIndex(currentHintIndex + 1);
        }
    };

    const playPressed = () => {
        ApplicationState.setLoadAccepted(true);
    };

    return (
        <div className="loading-page">
            {loading && (
                <div className="heading animated-ellipsis">
                    {Utils.getTextDef("Loading")}
                </div>
            )}
            {!loading && (
                <div className="heading">{Utils.getTextDef("Game loaded")}</div>
            )}

            <div className="loading-hint-cont">
                <div className="col image">
                    <img src={hint.image} className="loading-hint-image" draggable={false} />
                </div>
                <div className="col loading-hint-text">
                    {Utils.getTextDef(`Hint: ${hint.textDefId}`)}
                </div>
            </div>

            <div className="loading-next-hint-button" onClick={nextHintPressed}>
                {Utils.getTextDef("Next hint")}
            </div>

            {!loading && (
                <div className="loading-play-button-cont" onClick={playPressed}>
                    <img className="loading-play-button-border" src={playButtonBorder} draggable={false} />
                    <div className="loading-play-text">{Utils.getTextDef("Play")}</div>
                </div>
            )}
            {loading && (
                <LoadingBar />
            )}
        </div>
    );
}

export default LoadingPage;
