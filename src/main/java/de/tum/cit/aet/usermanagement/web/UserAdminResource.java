package de.tum.cit.aet.usermanagement.web;

import de.tum.cit.aet.core.dto.PageDTO;
import de.tum.cit.aet.core.dto.SortDTO;
import de.tum.cit.aet.core.security.annotations.Admin;
import de.tum.cit.aet.usermanagement.constants.UserRole;
import de.tum.cit.aet.usermanagement.dto.AdminUserDetailDTO;
import de.tum.cit.aet.usermanagement.dto.AdminUserOverviewDTO;
import de.tum.cit.aet.usermanagement.dto.CreateUserDTO;
import de.tum.cit.aet.usermanagement.dto.ImportUserDTO;
import de.tum.cit.aet.usermanagement.dto.UpdateUserDTO;
import de.tum.cit.aet.usermanagement.service.UserAdminService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST controller backing the admin "Manage Users" page.
 * Exposes paginated listing, detail, create, import, update, and delete endpoints
 * — all restricted to administrators.
 */
@Slf4j
@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
public class UserAdminResource {

    private final UserAdminService userAdminService;

    /**
     * {@code GET /api/admin/users} : Returns a paginated, filterable, searchable list of users for admins.
     *
     * @param pageDTO          pagination configuration
     * @param sortDTO          sorting configuration
     * @param roles            optional role filter
     * @param researchGroupIds optional research-group filter
     * @param searchQuery      optional free-text search query
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} containing a page of {@link AdminUserOverviewDTO}
     */
    @Admin
    @GetMapping
    public ResponseEntity<Page<AdminUserOverviewDTO>> getAllUsers(
        @ParameterObject @Valid @ModelAttribute PageDTO pageDTO,
        @ParameterObject @Valid @ModelAttribute SortDTO sortDTO,
        @RequestParam(required = false) List<UserRole> roles,
        @RequestParam(required = false) List<UUID> researchGroupIds,
        @RequestParam(required = false) String searchQuery
    ) {
        log.info("GET /api/admin/users - Fetching admin user list");
        return ResponseEntity.ok(userAdminService.getAllUsersForAdmin(pageDTO, sortDTO, roles, researchGroupIds, searchQuery));
    }

    /**
     * {@code GET /api/admin/users/{userId}} : Returns the full admin-scoped detail view for a single user.
     *
     * @param userId the user id to look up
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the user detail
     */
    @Admin
    @GetMapping("/{userId}")
    public ResponseEntity<AdminUserDetailDTO> getUser(@PathVariable UUID userId) {
        log.info("GET /api/admin/users/{} - Fetching admin user detail", userId);
        return ResponseEntity.ok(userAdminService.getUserDetail(userId));
    }

    /**
     * {@code POST /api/admin/users} : Creates a new Keycloak user and provisions a matching local-DB row.
     *
     * @param dto the create-user payload
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and the created user detail
     */
    @Admin
    @PostMapping
    public ResponseEntity<AdminUserDetailDTO> createUser(@RequestBody @Valid CreateUserDTO dto) {
        log.info("POST /api/admin/users - Creating user email={}", dto.email());
        UUID userId = userAdminService.create(dto);
        return ResponseEntity.status(201).body(userAdminService.getUserDetail(userId));
    }

    /**
     * {@code POST /api/admin/users/import} : Imports an existing TUM member from Keycloak into the local DB
     * by their university ID.
     *
     * @param dto the import payload containing the university id
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and the imported user detail
     */
    @Admin
    @PostMapping("/import")
    public ResponseEntity<AdminUserDetailDTO> importUser(@RequestBody @Valid ImportUserDTO dto) {
        log.info("POST /api/admin/users/import - Importing universityId={}", dto.universityId());
        UUID userId = userAdminService.importFromKeycloak(dto);
        return ResponseEntity.status(201).body(userAdminService.getUserDetail(userId));
    }

    /**
     * {@code PUT /api/admin/users/{userId}} : Updates DB-only fields of an existing user.
     *
     * @param userId the user id to update
     * @param dto    the update payload (any null field is left untouched)
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the refreshed user detail
     */
    @Admin
    @PutMapping("/{userId}")
    public ResponseEntity<AdminUserDetailDTO> updateUser(@PathVariable UUID userId, @RequestBody @Valid UpdateUserDTO dto) {
        log.info("PUT /api/admin/users/{} - Updating user", userId);
        userAdminService.update(userId, dto);
        return ResponseEntity.ok(userAdminService.getUserDetail(userId));
    }

    /**
     * {@code DELETE /api/admin/users/{userId}} : Deletes a user from Keycloak and anonymises their local-DB references.
     *
     * @param userId the user id to delete
     * @return the {@link ResponseEntity} with status {@code 204 (No Content)}
     */
    @Admin
    @DeleteMapping("/{userId}")
    public ResponseEntity<Void> deleteUser(@PathVariable UUID userId) {
        log.info("DELETE /api/admin/users/{} - Deleting user", userId);
        userAdminService.delete(userId);
        return ResponseEntity.noContent().build();
    }
}
