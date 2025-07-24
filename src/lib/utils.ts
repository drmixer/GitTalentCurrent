// src/lib/utils.ts

export const formatNumber = (num: number): string => {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
};

export const calculateProfileStrength = (developer: any): number => {
    let strength = 0;
    let maxPossible = 100; // Total possible points if all fields are filled

    // Points for core profile fields
    if (developer.bio && developer.bio.length > 0) strength += 10;
    if (developer.title && developer.title.length > 0) strength += 5;
    if (developer.experience_years && developer.experience_years > 0) strength += 5;
    if (developer.location && developer.location.length > 0) strength += 5;
    if (developer.desired_salary && developer.desired_salary > 0) strength += 5;
    if (developer.availability !== null) strength += 5; // Assuming boolean or explicit null check

    // Points for linked accounts/integrations
    if (developer.github_handle && developer.github_handle.length > 0) strength += 10;
    // We'll give points for app installation, but not penalize if it's not present for public view
    if (developer.github_installation_id) strength += 5;

    // Points for skills (assuming skills_categories is an object with categories)
    if (developer.skills_categories && Object.keys(developer.skills_categories).length > 0) {
        let skillPoints = 0;
        let categoryCount = 0;
        for (const category in developer.skills_categories) {
            categoryCount++;
            if (developer.skills_categories[category].skills.length > 0) {
                skillPoints += 5; // 5 points per category with skills
            }
        }
        if (categoryCount > 0) { // Max 15 points for skills (3 categories * 5 points)
            strength += Math.min(skillPoints, 15);
        }
    } else if (developer.skills && developer.skills.length > 0) { // Fallback for old 'skills' array
        strength += Math.min(developer.skills.length * 2, 15);
    }


    // Points for portfolio projects (assuming it's an array and has content)
    // This assumes portfolio_projects are part of the developer object or fetched elsewhere
    // If portfolio is fetched separately, adjust this logic or remove this line
    if (developer.portfolio_projects && developer.portfolio_projects.length > 0) strength += 15;

    // Points for endorsements (assuming number of public endorsements)
    // This would typically be fetched separately. For profile strength,
    // we might just check if *any* endorsements exist or give points per endorsement.
    // Let's assume a simple check for now:
    if (developer.public_endorsement_count && developer.public_endorsement_count > 0) {
        strength += Math.min(developer.public_endorsement_count * 2, 10); // Max 10 points for endorsements (e.g., 5 public endorsements)
    }


    // Max possible can be adjusted based on what you consider a "complete" profile
    // Let's refine maxPossible based on the points assigned above
    maxPossible = 10 + 5 + 5 + 5 + 5 + 5 + // Bio, Title, Exp, Location, Salary, Availability (35)
                  10 + 5 + // GitHub handle, installation (15)
                  15 + // Skills (max)
                  15 + // Portfolio (max)
                  10;  // Endorsements (max)
    // Total max possible points: 35 + 15 + 15 + 15 + 10 = 90. Let's make it 100 as originally stated.
    // If adding more fields or adjusting points, ensure it aligns with maxPossible.
    // For simplicity, let's just make the calculated strength out of a fixed 100 for now.

    const percentage = (strength / maxPossible) * 100;

    // Cap at 100%
    return Math.min(Math.round(percentage), 100);
};
