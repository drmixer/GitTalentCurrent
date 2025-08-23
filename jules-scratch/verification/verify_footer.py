from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch()
    page = browser.new_page()

    # Go to the landing page
    page.goto("http://localhost:4174/")

    # Wait for the subtitle to be visible, indicating the page has loaded
    expect(page.locator('p:has-text("We match developers based on real GitHub work")')).to_be_visible()

    # Scroll to the bottom to make sure the footer is in view
    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")

    # Take a screenshot of the landing page with the footer
    page.screenshot(path="jules-scratch/verification/landing_page_with_footer.png")

    # Wait for the link to be visible
    privacy_policy_link = page.locator('a:has-text("Privacy Policy")')
    expect(privacy_policy_link).to_be_visible()

    # Click the "Privacy Policy" link
    privacy_policy_link.click()

    # Wait for the navigation to complete
    page.wait_for_load_state("networkidle")

    # Wait for the privacy policy heading to be visible
    expect(page.locator('h1:has-text("Privacy Policy")')).to_be_visible()

    # Take a screenshot of the privacy policy page
    page.screenshot(path="jules-scratch/verification/privacy_policy_page.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
