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
    // Changed developer.bio.length to check if it's a string first
    if (typeof developer.bio === 'string' && developer.bio.length > 0) strength += 10;
    // FIXED: Changed 'title' to 'preferred_title' and added string check
    if (typeof developer.preferred_title === 'string' && developer.preferred_title.length > 0) strength += 5;
    if (developer.experience_years && developer.experience_years > 0) strength += 5;
    // Changed developer.location.length to check if it's a string first
    if (typeof developer.location === 'string' && developer.location.length > 0) strength += 5;
    if (developer.desired_salary && developer.desired_salary > 0) strength += 5;
    if (developer.availability !== null) strength += 5; // Assuming boolean or explicit null check

    // Points for linked accounts/integrations
    // Changed developer.github_handle.length to check if it's a string first
    if (typeof developer.github_handle === 'string' && developer.github_handle.length > 0) strength += 10;
    if (developer.github_installation_id) strength += 5;

    // Points for skills (assuming skills_categories is an object with categories)
    if (developer.skills_categories && typeof developer.skills_categories === 'object' && Object.keys(developer.skills_categories).length > 0) {
        let skillPoints = 0;
        let categoryCount = 0;
        for (const category in developer.skills_categories) {
            // Ensure the category property exists and is an object before accessing 'skills'
            if (developer.skills_categories.hasOwnProperty(category) && typeof developer.skills_categories[category] === 'object') {
                categoryCount++;
                // Ensure skills property exists and is an array before checking length
                if (Array.isArray(developer.skills_categories[category].skills) && developer.skills_categories[category].skills.length > 0) {
                    skillPoints += 5; // 5 points per category with skills
                }
            }
        }
        if (categoryCount > 0) {
            strength += Math.min(skillPoints, 15); // Max 15 points for skills
        }
    // Fallback for old 'skills' array - ensure it's an array
    } else if (Array.isArray(developer.skills) && developer.skills.length > 0) {
        strength += Math.min(developer.skills.length * 2, 15);
    }

    // Points for portfolio projects (assuming it's an array and has content)
    // FIXED: Changed 'portfolio_projects' to 'linked_projects' and added array check
    if (Array.isArray(developer.linked_projects) && developer.linked_projects.length > 0) strength += 15;

    // Points for endorsements (assuming number of public endorsements)
    // FIXED: Added check for public_endorsement_count being a number
    if (typeof developer.public_endorsement_count === 'number' && developer.public_endorsement_count > 0) {
        strength += Math.min(developer.public_endorsement_count * 2, 10); // Max 10 points for endorsements (e.g., 5 public endorsements)
    }


    // Recalculate maxPossible based on the points assigned above
    // This ensures your percentage calculation is accurate
    maxPossible = 10 + // Bio
                  5 +  // Preferred Title
                  5 +  // Experience Years
                  5 +  // Location
                  5 +  // Desired Salary
                  5 +  // Availability
                  10 + // GitHub Handle
                  5 +  // GitHub Installation ID
                  15 + // Skills (max)
                  15 + // Linked Projects (max)
                  10;  // Endorsements (max)
    // Total max possible points: 80 (if all criteria met)

    const percentage = (strength / maxPossible) * 100;

    // Cap at 100%
    return Math.min(Math.round(percentage), 100);
};
