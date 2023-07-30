import { useQuery } from "convex/react"
import { api } from "../convex/_generated/api"
import { Fragment, useState } from "react";
import { Doc } from "../convex/_generated/dataModel";

const Achievement = ({userAchievement}: {userAchievement: Doc<'userAchievements'> & {achievement: Doc<'achievements'>}}) => {
    const {achievement} = userAchievement;
    return <div style={{paddingBottom: '1em'}}>
        <div style={{fontWeight: 700}}>
            {achievement.name}
        </div>
        <div style={{fontStyle: 'italic'}}>
            {achievement.description}
        </div>
        <div>Category: {achievement.category}</div>
        <div>
            Achieved: {new Date(userAchievement._creationTime).toLocaleString()}
        </div>
    </div>
}

export const Achievements = () => {
    const achievements = useQuery(api.user_achievements.list) ?? [];
    const [isCollapsed, setIsCollapsed] = useState<boolean>(true);

    return <Fragment>
        <button onClick={() => setIsCollapsed(!isCollapsed)}>{achievements.length} Achievements</button>
        {!isCollapsed && <div style={{
            position: 'absolute',
            left: 10,
            right: 10,
            // Depends on NAV_HEIGHT...
            top: 10 + 45,
            bottom: 10,
            backgroundColor: 'white',
            zIndex: 20000,
            borderRadius: 6,
            boxShadow: '0 3px 10px rgb(0 0 0 / 0.2)',
        }}>
            <div style={{padding: '2em'}}>            
                {achievements.map(achievement => (
                    <Achievement key={achievement._id} userAchievement={achievement} />
                ))}
            </div>
        </div>}
    </Fragment>
}