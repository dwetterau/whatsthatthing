import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Doc, Id } from "../convex/_generated/dataModel";

const Achievement = ({
    achievement,
    achievedTimeMillis,
}: {
    achievement: Doc<"achievements">;
    achievedTimeMillis: number | null;
}) => {
    const isLocked = achievedTimeMillis === null;
    return (
        <div
            style={{
                paddingBottom: "1em",
                opacity: isLocked ? 0.6 : undefined,
            }}
        >
            <div style={{ fontWeight: 700 }}>{achievement.name}</div>
            {!isLocked && (
                <div style={{ fontStyle: "italic" }}>
                    {achievement.description}
                </div>
            )}
            <div>Category: {achievement.category}</div>
            {!isLocked && (
                <div>
                    Achieved: {new Date(achievedTimeMillis).toLocaleString()}
                </div>
            )}
        </div>
    );
};

export const Achievements = () => {
    const achievements = useQuery(api.user_achievements.list) ?? [];
    const allAchievements = useQuery(api.achievements.get) ?? [];
    const [isCollapsed, setIsCollapsed] = useState<boolean>(true);

    const lockedAchievements = useMemo(() => {
        const achieved = new Set<Id<"achievements">>();
        achievements.forEach((achievement) => {
            achieved.add(achievement.achievementId);
        });
        return allAchievements.filter((achievement) => {
            return !achieved.has(achievement._id);
        });
    }, [achievements, allAchievements]);

    useEffect(() => {
        const closeOnEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                if (!isCollapsed) {
                    setIsCollapsed(true);
                }
            }
        };

        document.addEventListener("keydown", closeOnEscape, false);
        () => {
            document.removeEventListener("keydown", closeOnEscape, false);
        };
    }, [isCollapsed]);

    return (
        <Fragment>
            <button onClick={() => setIsCollapsed(!isCollapsed)}>
                {achievements.length} Achievements (out of{" "}
                {allAchievements.length})
            </button>
            {!isCollapsed && (
                <div
                    style={{
                        position: "absolute",
                        left: 10,
                        right: 10,
                        // Depends on NAV_HEIGHT...
                        top: 10 + 45,
                        bottom: 10,
                        backgroundColor: "white",
                        zIndex: 20000,
                        borderRadius: 6,
                        boxShadow: "0 3px 10px rgb(0 0 0 / 0.2)",
                        overflowY: "scroll",
                        overflowX: "hidden",
                    }}
                >
                    <button
                        style={{
                            float: "right",
                            margin: "1em",
                            position: "fixed",
                            right: 20,
                        }}
                        onClick={() => {
                            setIsCollapsed(true);
                        }}
                    >
                        Close
                    </button>
                    <div style={{ padding: "2em" }}>
                        {achievements.map((achievement) => (
                            <Achievement
                                key={achievement._id}
                                achievement={achievement.achievement}
                                achievedTimeMillis={achievement._creationTime}
                            />
                        ))}
                        {lockedAchievements.map((achievement) => (
                            <Achievement
                                achievement={achievement}
                                achievedTimeMillis={null}
                            />
                        ))}
                    </div>
                </div>
            )}
        </Fragment>
    );
};
