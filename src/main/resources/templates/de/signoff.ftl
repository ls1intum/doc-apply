<#-- Platform system sign-off (informal "Du"), uses the SITE_NAME template variable -->
<#macro system>
    <p>Mit freundlichen Grüßen<br />Dein ${SITE_NAME!} Team</p>
</#macro>

<#-- Research group sign-off, uses the RESEARCH_GROUP_NAME template variable -->
<#macro researchGroup>
    <p>Mit freundlichen Grüßen<br />Dein ${RESEARCH_GROUP_NAME!} Team</p>
</#macro>

<#-- Platform system sign-off (formal "Sie") for external recipients -->
<#macro systemFormal>
    <p>Mit freundlichen Grüßen<br />Ihr ${SITE_NAME!} Team</p>
</#macro>
